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
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
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

function publicNameFor(profile: ProfileRow | undefined) {
  return profile?.nickname?.trim() || profile?.full_name?.trim() || "SlimYet member";
}

export async function GET() {
  if (!hasServerConfig()) {
    return jsonError("Supabase environment variables are missing.", 503, "SUPABASE_NOT_CONFIGURED");
  }

  const admin = getAdminClient();
  const [groupsResult, membersResult, profilesResult, logsResult] = await Promise.all([
    admin.from("slim_groups").select("id,name,description").limit(1000),
    admin.from("slim_group_members").select("group_id,user_id,base_weight_kg").limit(20000),
    admin.from("slim_profiles").select("id,full_name,nickname,avatar_url").limit(20000),
    admin
      .from("slim_weight_logs")
      .select("user_id,recorded_on,weight_kg")
      .order("recorded_on", { ascending: true })
      .limit(50000)
  ]);

  const firstError = [groupsResult, membersResult, profilesResult, logsResult].find(
    (result) => result.error
  )?.error;

  if (firstError) {
    return jsonError(firstError.message, 500);
  }

  const groups = (groupsResult.data ?? []) as GroupRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const profilesById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const logsByUser = new Map<
    string,
    {
      firstDate: string;
      firstWeight: number;
      latestDate: string;
      latestWeight: number;
      count: number;
    }
  >();

  for (const log of (logsResult.data ?? []) as WeightLogRow[]) {
    const weight = Number(log.weight_kg);
    if (!Number.isFinite(weight)) {
      continue;
    }

    const current = logsByUser.get(log.user_id);
    if (!current) {
      logsByUser.set(log.user_id, {
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
        const latestLog = logsByUser.get(member.user_id);
        if (baseWeight === null || !latestLog) {
          continue;
        }

        readyCount += 1;
        totalLossKg += Math.max(0, baseWeight - latestLog.latestWeight);
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

  const userLossRows = Array.from(logsByUser.entries()).map(([userId, logs]) => ({
    userId,
    lossKg: roundTenth(Math.max(0, logs.firstWeight - logs.latestWeight)) ?? 0,
    loggedDays: logs.count,
    profile: profilesById.get(userId)
  }));

  const topUsers = userLossRows
    .filter((user) => user.lossKg > 0 && user.loggedDays >= 2)
    .sort((left, right) => {
      if (right.lossKg !== left.lossKg) {
        return right.lossKg - left.lossKg;
      }
      return right.loggedDays - left.loggedDays;
    })
    .slice(0, 5)
    .map((user) => ({
      userId: user.userId,
      displayName: publicNameFor(user.profile),
      avatarUrl: user.profile?.avatar_url ?? null,
      lossKg: user.lossKg,
      loggedDays: user.loggedDays
    }));

  const totalLossKg =
    roundTenth(userLossRows.reduce((sum, user) => sum + Math.max(0, user.lossKg), 0)) ?? 0;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      groupCount: groups.length,
      userCount: profilesById.size,
      totalLossKg
    },
    topGroups,
    topUsers
  });
}
