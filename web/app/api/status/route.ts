import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError, roundTenth, todayIso } from "../_lib/server";

type WeightLogRow = {
  user_id: string;
  recorded_on: string;
  weight_kg: number | string;
};

function countValue(result: { count: number | null }) {
  return result.count ?? 0;
}

function weekStartIso() {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function totalLossFromUserLogs(logs: WeightLogRow[]) {
  const byUser = new Map<
    string,
    {
      firstDate: string;
      firstWeight: number;
      latestDate: string;
      latestWeight: number;
      count: number;
    }
  >();

  for (const log of logs) {
    const weight = Number(log.weight_kg);
    if (!Number.isFinite(weight)) {
      continue;
    }

    const current = byUser.get(log.user_id);
    if (!current) {
      byUser.set(log.user_id, {
        firstDate: log.recorded_on,
        firstWeight: weight,
        latestDate: log.recorded_on,
        latestWeight: weight,
        count: 1
      });
      continue;
    }

    current.count += 1;
    if (log.recorded_on < current.firstDate) {
      current.firstDate = log.recorded_on;
      current.firstWeight = weight;
    }
    if (log.recorded_on >= current.latestDate) {
      current.latestDate = log.recorded_on;
      current.latestWeight = weight;
    }
  }

  let totalLossKg = 0;
  let usersWithProgressCount = 0;

  for (const user of byUser.values()) {
    if (user.count < 2) {
      continue;
    }

    usersWithProgressCount += 1;
    totalLossKg += Math.max(0, user.firstWeight - user.latestWeight);
  }

  return {
    totalUserLossKg: roundTenth(totalLossKg) ?? 0,
    usersWithProgressCount
  };
}

export async function GET(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const today = todayIso();
  const weekStart = weekStartIso();

  const [
    groupCountResult,
    userCountResult,
    membershipCountResult,
    readyMemberCountResult,
    logsTodayResult,
    feedItems7dResult,
    reactions7dResult,
    activeFeedResult,
    logsResult
  ] = await Promise.all([
    context.admin.from("slim_groups").select("id", { count: "exact", head: true }),
    context.admin.from("slim_profiles").select("id", { count: "exact", head: true }),
    context.admin.from("slim_group_members").select("id", { count: "exact", head: true }),
    context.admin
      .from("slim_group_members")
      .select("id", { count: "exact", head: true })
      .not("base_weight_kg", "is", null),
    context.admin
      .from("slim_weight_logs")
      .select("id", { count: "exact", head: true })
      .eq("recorded_on", today),
    context.admin
      .from("slim_feed_items")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
    context.admin
      .from("slim_feed_reactions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
    context.admin
      .from("slim_feed_items")
      .select("group_id")
      .gte("created_at", weekStart)
      .limit(10000),
    context.admin
      .from("slim_weight_logs")
      .select("user_id,recorded_on,weight_kg")
      .order("user_id", { ascending: true })
      .order("recorded_on", { ascending: true })
      .limit(10000)
  ]);

  const firstError = [
    groupCountResult,
    userCountResult,
    membershipCountResult,
    readyMemberCountResult,
    logsTodayResult,
    feedItems7dResult,
    reactions7dResult,
    activeFeedResult,
    logsResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    return jsonError(firstError.message, 500);
  }

  const activeGroups = new Set((activeFeedResult.data ?? []).map((row) => row.group_id));
  const lossStats = totalLossFromUserLogs((logsResult.data ?? []) as WeightLogRow[]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      groupCount: countValue(groupCountResult),
      userCount: countValue(userCountResult),
      membershipCount: countValue(membershipCountResult),
      readyMemberCount: countValue(readyMemberCountResult),
      ...lossStats,
      logsTodayCount: countValue(logsTodayResult),
      activeGroupCount7d: activeGroups.size,
      feedItems7dCount: countValue(feedItems7dResult),
      reactions7dCount: countValue(reactions7dResult)
    }
  });
}
