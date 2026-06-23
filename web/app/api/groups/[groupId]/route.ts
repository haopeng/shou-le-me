import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  isAuthContext,
  jsonError,
  requireMembership,
  roundTenth,
  todayIso
} from "../../_lib/server";

type RouteContext = {
  params: Promise<{
    groupId: string;
  }>;
};

type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  base_weight_kg: number | string | null;
  base_date: string | null;
  joined_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
};

type WeightLogRow = {
  id: string;
  member_id: string;
  recorded_on: string;
  weight_kg: number | string;
  note: string | null;
  created_at: string;
};

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayNameFor(member: MemberRow, profile: ProfileRow | undefined) {
  const name =
    member.display_name ||
    profile?.nickname ||
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    "Member";

  return name.trim() || "Member";
}

function badgeKeys(logs: WeightLogRow[], baseWeight: number | null, latestWeight: number | null) {
  const badges: string[] = [];
  const today = todayIso();

  if (baseWeight !== null && latestWeight !== null && latestWeight < baseWeight) {
    badges.push("badgeBelowStart");
  }

  if (baseWeight !== null && latestWeight !== null && baseWeight - latestWeight >= 1) {
    badges.push("badgeSpark");
  }

  if (logs.length >= 3) {
    badges.push("badgeStreak");
  }

  if (logs.at(-1)?.recorded_on === today) {
    badges.push("badgeFresh");
  }

  const recentLogs = logs.slice(-7);
  if (recentLogs.length >= 2 && latestWeight !== null) {
    const recentWeights = recentLogs.map((log) => Number(log.weight_kg));
    if (latestWeight <= Math.min(...recentWeights)) {
      badges.push("badgeWeekLow");
    }
  }

  if (logs.length >= 2 && baseWeight !== null) {
    const previous = Number(logs.at(-2)?.weight_kg);
    if (Number.isFinite(previous) && latestWeight !== null && latestWeight < previous) {
      badges.push("badgeComeback");
    }
  }

  return badges.slice(0, 4);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId } = await context.params;
  const membership = await requireMembership(auth.admin, groupId, auth.user.id);

  if (!membership) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const { data: group, error: groupError } = await auth.admin
    .from("slim_groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) {
    return jsonError(groupError.message, 500);
  }

  const { data: members, error: membersError } = await auth.admin
    .from("slim_group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (membersError) {
    return jsonError(membersError.message, 500);
  }

  const memberRows = (members ?? []) as MemberRow[];
  const memberIds = memberRows.map((member) => member.id);
  const userIds = memberRows.map((member) => member.user_id);

  const profilesById = new Map<string, ProfileRow>();

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await auth.admin
      .from("slim_profiles")
      .select("id,email,full_name,nickname,avatar_url")
      .in("id", userIds);

    if (profilesError) {
      return jsonError(profilesError.message, 500);
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      profilesById.set(profile.id, profile);
    }
  }

  const logsByMember = new Map<string, WeightLogRow[]>();

  if (memberIds.length) {
    const { data: logs, error: logsError } = await auth.admin
      .from("slim_weight_logs")
      .select("id,member_id,recorded_on,weight_kg,note,created_at")
      .in("member_id", memberIds)
      .order("recorded_on", { ascending: true });

    if (logsError) {
      return jsonError(logsError.message, 500);
    }

    for (const log of (logs ?? []) as WeightLogRow[]) {
      const existing = logsByMember.get(log.member_id) ?? [];
      existing.push(log);
      logsByMember.set(log.member_id, existing);
    }
  }

  const computed = memberRows.map((member) => {
    const logs = logsByMember.get(member.id) ?? [];
    const baseWeight = numberOrNull(member.base_weight_kg);
    const latestLog = logs.at(-1) ?? null;
    const latestWeight = latestLog ? Number(latestLog.weight_kg) : null;
    const previousLog = logs.length >= 2 ? logs.at(-2) : null;
    const previousWeight = previousLog ? Number(previousLog.weight_kg) : null;
    const deltaKg =
      baseWeight !== null && latestWeight !== null ? roundTenth(latestWeight - baseWeight) : null;
    const previousDeltaKg =
      baseWeight !== null && previousWeight !== null
        ? roundTenth(previousWeight - baseWeight)
        : null;

    return {
      member,
      logs,
      baseWeight,
      latestWeight,
      deltaKg,
      previousDeltaKg,
      latestDate: latestLog?.recorded_on ?? null
    };
  });

  const ranked = computed
    .filter((entry) => entry.deltaKg !== null)
    .sort((left, right) => left.deltaKg! - right.deltaKg!);
  const rankByMember = new Map<string, number>();
  ranked.forEach((entry, index) => {
    rankByMember.set(entry.member.id, index + 1);
  });

  const today = todayIso();
  const membersPayload = computed
    .map((entry) => {
      const profile = profilesById.get(entry.member.user_id);
      const sparkline =
        entry.baseWeight === null
          ? []
          : entry.logs.slice(-21).map((log) => ({
              date: log.recorded_on,
              deltaKg: roundTenth(Number(log.weight_kg) - entry.baseWeight!) ?? 0
            }));

      return {
        memberId: entry.member.id,
        userId: entry.member.user_id,
        displayName: displayNameFor(entry.member, profile),
        avatarUrl: profile?.avatar_url ?? null,
        role: entry.member.role,
        joinedAt: entry.member.joined_at,
        baseDate: entry.member.base_date,
        latestDate: entry.latestDate,
        deltaKg: entry.deltaKg,
        previousDeltaKg: entry.previousDeltaKg,
        daysLogged: entry.logs.length,
        rank: rankByMember.get(entry.member.id) ?? null,
        badges: badgeKeys(entry.logs, entry.baseWeight, entry.latestWeight),
        sparkline,
        isMe: entry.member.user_id === auth.user.id
      };
    })
    .sort((left, right) => {
      if (left.rank && right.rank) {
        return left.rank - right.rank;
      }
      if (left.rank) {
        return -1;
      }
      if (right.rank) {
        return 1;
      }
      return left.joinedAt.localeCompare(right.joinedAt);
    });

  const ownLogs = (logsByMember.get(membership.id) ?? []).map((log) => {
    const weightKg = Number(log.weight_kg);
    const baseWeight = numberOrNull(membership.base_weight_kg);
    return {
      id: log.id,
      recordedOn: log.recorded_on,
      weightKg: roundTenth(weightKg) ?? weightKg,
      note: log.note,
      deltaKg: baseWeight !== null ? roundTenth(weightKg - baseWeight) : null
    };
  });

  const deltas = computed
    .map((entry) => entry.deltaKg)
    .filter((delta): delta is number => delta !== null);

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.invite_code,
      ownerId: group.owner_id,
      createdAt: group.created_at
    },
    me: {
      memberId: membership.id,
      role: membership.role,
      baseReady: membership.base_weight_kg !== null,
      baseDate: membership.base_date
    },
    stats: {
      memberCount: memberRows.length,
      readyCount: computed.filter((entry) => entry.baseWeight !== null).length,
      loggedTodayCount: computed.filter((entry) => entry.latestDate === today).length,
      totalLossKg: roundTenth(
        deltas.reduce((sum, delta) => sum + Math.max(0, -delta), 0)
      ),
      bestDeltaKg: deltas.length ? roundTenth(Math.min(...deltas)) : null
    },
    members: membersPayload,
    ownLogs
  });
}
