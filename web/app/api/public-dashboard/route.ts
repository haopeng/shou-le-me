import { NextResponse } from "next/server";
import { getAdminClient, hasServerConfig, jsonError, roundTenth } from "../_lib/server";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  base_weight_kg: number | string | null;
  base_date: string | null;
};

type WeightLogRow = {
  user_id: string;
  recorded_on: string;
  weight_kg: number | string;
};

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET() {
  if (!hasServerConfig()) {
    return jsonError("Supabase environment variables are missing.", 503, "SUPABASE_NOT_CONFIGURED");
  }

  const admin = getAdminClient();
  const [groupsResult, membersResult, logsResult] = await Promise.all([
    admin.from("slim_groups").select("id,name,description").limit(1000),
    admin.from("slim_group_members").select("group_id,user_id,base_weight_kg,base_date").limit(20000),
    admin
      .from("slim_weight_logs")
      .select("user_id,recorded_on,weight_kg")
      .order("recorded_on", { ascending: true })
      .limit(50000)
  ]);

  const firstError = [groupsResult, membersResult, logsResult].find(
    (result) => result.error
  )?.error;

  if (firstError) {
    return jsonError(firstError.message, 500);
  }

  const groups = (groupsResult.data ?? []) as GroupRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const logRowsByUser = new Map<string, WeightLogRow[]>();

  for (const log of (logsResult.data ?? []) as WeightLogRow[]) {
    const weight = Number(log.weight_kg);
    if (!Number.isFinite(weight)) {
      continue;
    }

    const existingRows = logRowsByUser.get(log.user_id) ?? [];
    existingRows.push(log);
    logRowsByUser.set(log.user_id, existingRows);
  }

  const membersByGroup = new Map<string, MemberRow[]>();
  for (const member of members) {
    const existing = membersByGroup.get(member.group_id) ?? [];
    existing.push(member);
    membersByGroup.set(member.group_id, existing);
  }

  const topGroups = groups
    .map((group) => {
      const groupMembers = membersByGroup.get(group.id) ?? [];
      let totalLossKg = 0;
      let readyCount = 0;

      for (const member of groupMembers) {
        const baseWeight = numberOrNull(member.base_weight_kg);
        const memberLogs = logRowsByUser.get(member.user_id) ?? [];
        const scopedLogs = member.base_date
          ? memberLogs.filter((log) => log.recorded_on >= member.base_date!)
          : memberLogs;
        const latestLog = scopedLogs.at(-1) ?? null;
        if (baseWeight === null || !latestLog) {
          continue;
        }

        readyCount += 1;
        totalLossKg += Math.max(0, baseWeight - Number(latestLog.weight_kg));
      }

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: groupMembers.length,
        readyCount,
        totalLossKg: roundTenth(totalLossKg) ?? 0
      };
    })
    .sort((left, right) => {
      if (right.totalLossKg !== left.totalLossKg) {
        return right.totalLossKg - left.totalLossKg;
      }
      if (right.memberCount !== left.memberCount) {
        return right.memberCount - left.memberCount;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);

  const totalLossKg =
    roundTenth(topGroups.reduce((sum, group) => sum + Math.max(0, group.totalLossKg), 0)) ?? 0;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      groupCount: groups.length,
      totalLossKg
    },
    topGroups
  });
}
