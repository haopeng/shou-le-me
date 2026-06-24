import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError, roundTenth } from "../../_lib/server";

type WeightLogRow = {
  id: string;
  recorded_on: string;
  weight_kg: number | string;
  note: string | null;
};

function average(values: number[]) {
  if (!values.length) {
    return null;
  }
  return roundTenth(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function GET(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const { data, error } = await context.admin
    .from("slim_weight_logs")
    .select("id,recorded_on,weight_kg,note")
    .eq("user_id", context.user.id)
    .order("recorded_on", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  const rows = (data ?? []) as WeightLogRow[];
  const logs = rows.map((log) => ({
    id: log.id,
    recordedOn: log.recorded_on,
    weightKg: roundTenth(Number(log.weight_kg)) ?? Number(log.weight_kg),
    note: log.note
  }));
  const weights = logs.map((log) => log.weightKg);
  const first = logs[0] ?? null;
  const previous = logs.length >= 2 ? logs.at(-2)! : null;
  const latest = logs.at(-1) ?? null;
  const lowest = logs.reduce<(typeof logs)[number] | null>(
    (winner, log) => (!winner || log.weightKg < winner.weightKg ? log : winner),
    null
  );
  const average30Kg = average(weights.slice(-30));
  const changeFromFirstKg =
    first && latest && logs.length >= 2 ? roundTenth(latest.weightKg - first.weightKg) : null;
  const changeFromPreviousKg =
    previous && latest ? roundTenth(latest.weightKg - previous.weightKg) : null;

  const highlights = [
    latest && lowest && latest.recordedOn === lowest.recordedOn
      ? {
          kind: "personal_low",
          valueKg: latest.weightKg,
          auxKg: null,
          date: latest.recordedOn,
          count: null,
          tone: "good"
        }
      : null,
    latest && average30Kg !== null && latest.weightKg < average30Kg
      ? {
          kind: "below_average",
          valueKg: roundTenth(average30Kg - latest.weightKg),
          auxKg: average30Kg,
          date: latest.recordedOn,
          count: Math.min(30, logs.length),
          tone: "good"
        }
      : null,
    changeFromPreviousKg !== null
      ? {
          kind: "latest_move",
          valueKg: changeFromPreviousKg,
          auxKg: previous?.weightKg ?? null,
          date: latest?.recordedOn ?? null,
          count: null,
          tone: changeFromPreviousKg < 0 ? "good" : changeFromPreviousKg === 0 ? "steady" : "warm"
        }
      : null,
    logs.length >= 3
      ? {
          kind: "consistency",
          valueKg: null,
          auxKg: null,
          date: null,
          count: logs.length,
          tone: "steady"
        }
      : null
  ].filter(Boolean);

  return NextResponse.json({
    stats: {
      latestWeightKg: latest?.weightKg ?? null,
      previousWeightKg: previous?.weightKg ?? null,
      changeFromFirstKg,
      changeFromPreviousKg,
      lowestWeightKg: lowest?.weightKg ?? null,
      lowestDate: lowest?.recordedOn ?? null,
      average30Kg,
      loggedDays: logs.length,
      lastLoggedOn: latest?.recordedOn ?? null
    },
    logs,
    highlights
  });
}
