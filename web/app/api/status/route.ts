import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  isAuthContext,
  isStatusAdmin,
  jsonError,
  roundTenth,
  todayIso
} from "../_lib/server";

type WeightLogRow = {
  user_id: string;
  recorded_on: string;
  weight_kg: number | string;
};

type GroupRow = {
  id: string;
  name: string;
  owner_id: string;
};

type MemberRow = {
  group_id: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
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

  if (!isStatusAdmin(context.user.email)) {
    return jsonError("Status dashboard is private.", 403, "STATUS_FORBIDDEN");
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
    logsResult,
    groupsResult,
    membersResult,
    profilesResult
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
      .limit(10000),
    context.admin.from("slim_groups").select("id,name,owner_id").order("name", { ascending: true }),
    context.admin
      .from("slim_group_members")
      .select("group_id,user_id")
      .order("joined_at", { ascending: true })
      .limit(20000),
    context.admin.from("slim_profiles").select("id,email").limit(20000)
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
    logsResult,
    groupsResult,
    membersResult,
    profilesResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    return jsonError(firstError.message, 500);
  }

  const activeGroups = new Set((activeFeedResult.data ?? []).map((row) => row.group_id));
  const lossStats = totalLossFromUserLogs((logsResult.data ?? []) as WeightLogRow[]);
  const profilesById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const membersByGroup = new Map<string, MemberRow[]>();

  for (const member of (membersResult.data ?? []) as MemberRow[]) {
    const existing = membersByGroup.get(member.group_id) ?? [];
    existing.push(member);
    membersByGroup.set(member.group_id, existing);
  }

  const groups = ((groupsResult.data ?? []) as GroupRow[]).map((group) => {
    const memberRows = membersByGroup.get(group.id) ?? [];
    const memberEmails = Array.from(
      new Set(
        memberRows
          .map((member) => profilesById.get(member.user_id)?.email?.trim() ?? null)
          .filter((email): email is string => Boolean(email))
      )
    ).sort((left, right) => left.localeCompare(right));

    return {
      id: group.id,
      name: group.name,
      ownerEmail: profilesById.get(group.owner_id)?.email ?? null,
      memberCount: memberRows.length,
      memberEmails
    };
  });

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
    },
    groups
  });
}
