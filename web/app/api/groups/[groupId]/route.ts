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
  user_id: string;
  recorded_on: string;
  weight_kg: number | string;
  note: string | null;
  created_at: string;
};

type FeedKind = "delta_update" | "first_delta" | "base_set";
type ReactionType = "like" | "heart" | "care" | "thumbs_down";

type FeedRow = {
  id: string;
  group_id: string;
  actor_user_id: string;
  actor_member_id: string | null;
  kind: FeedKind;
  recorded_on: string | null;
  previous_delta_kg: number | string | null;
  new_delta_kg: number | string | null;
  created_at: string;
};

type ReactionRow = {
  feed_item_id: string;
  user_id: string;
  reaction: ReactionType;
};

type ReactionUser = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
};

type MemberHighlight = {
  kind:
    | "base_needed"
    | "current_delta"
    | "latest_move"
    | "best_point"
    | "below_average"
    | "consistency";
  valueKg: number | null;
  auxKg: number | null;
  date: string | null;
  count: number | null;
  tone: "good" | "steady" | "warm";
};

const reactionTypes: ReactionType[] = ["like", "heart", "care", "thumbs_down"];

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

function memberHighlights(
  logs: WeightLogRow[],
  sparkline: Array<{ date: string; deltaKg: number }>,
  deltaKg: number | null,
  previousDeltaKg: number | null
) {
  const highlights: MemberHighlight[] = [];

  if (deltaKg === null) {
    return [
      {
        kind: "base_needed",
        valueKg: null,
        auxKg: null,
        date: null,
        count: null,
        tone: "warm"
      }
    ];
  }

  highlights.push({
    kind: "current_delta",
    valueKg: deltaKg,
    auxKg: null,
    date: sparkline.at(-1)?.date ?? null,
    count: null,
    tone: deltaKg <= 0 ? "good" : "warm"
  });

  if (previousDeltaKg !== null) {
    const move = roundTenth(deltaKg - previousDeltaKg) ?? 0;
    highlights.push({
      kind: "latest_move",
      valueKg: move,
      auxKg: previousDeltaKg,
      date: sparkline.at(-1)?.date ?? null,
      count: null,
      tone: move < 0 ? "good" : move === 0 ? "steady" : "warm"
    });
  }

  if (sparkline.length >= 2) {
    const best = sparkline.reduce((winner, point) =>
      point.deltaKg < winner.deltaKg ? point : winner
    );
    highlights.push({
      kind: "best_point",
      valueKg: best.deltaKg,
      auxKg: null,
      date: best.date,
      count: null,
      tone: "good"
    });
  }

  const recent = sparkline.slice(-30);
  if (recent.length >= 3) {
    const average = recent.reduce((sum, point) => sum + point.deltaKg, 0) / recent.length;
    const gap = roundTenth(average - deltaKg) ?? 0;
    if (gap > 0) {
      highlights.push({
        kind: "below_average",
        valueKg: gap,
        auxKg: roundTenth(average),
        date: null,
        count: recent.length,
        tone: "good"
      });
    }
  }

  if (logs.length >= 3) {
    highlights.push({
      kind: "consistency",
      valueKg: null,
      auxKg: null,
      date: null,
      count: logs.length,
      tone: "steady"
    });
  }

  return highlights.slice(0, 4);
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
  const userIds = memberRows.map((member) => member.user_id);
  const membersByUserId = new Map(memberRows.map((member) => [member.user_id, member]));

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

  const logsByUser = new Map<string, WeightLogRow[]>();

  if (userIds.length) {
    const { data: logs, error: logsError } = await auth.admin
      .from("slim_weight_logs")
      .select("id,user_id,recorded_on,weight_kg,note,created_at")
      .in("user_id", userIds)
      .order("recorded_on", { ascending: true });

    if (logsError) {
      return jsonError(logsError.message, 500);
    }

    for (const log of (logs ?? []) as WeightLogRow[]) {
      const existing = logsByUser.get(log.user_id) ?? [];
      existing.push(log);
      logsByUser.set(log.user_id, existing);
    }
  }

  const computed = memberRows.map((member) => {
    const logs = logsByUser.get(member.user_id) ?? [];
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
        highlights: memberHighlights(entry.logs, sparkline, entry.deltaKg, entry.previousDeltaKg),
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

  const deltas = computed
    .map((entry) => entry.deltaKg)
    .filter((delta): delta is number => delta !== null);

  const { data: feedItems, error: feedError } = await auth.admin
    .from("slim_feed_items")
    .select(
      "id,group_id,actor_user_id,actor_member_id,kind,recorded_on,previous_delta_kg,new_delta_kg,created_at"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (feedError) {
    return jsonError(feedError.message, 500);
  }

  const feedRows = (feedItems ?? []) as FeedRow[];
  const feedIds = feedRows.map((item) => item.id);
  const reactionsByFeed = new Map<string, ReactionRow[]>();

  if (feedIds.length) {
    const { data: reactions, error: reactionsError } = await auth.admin
      .from("slim_feed_reactions")
      .select("feed_item_id,user_id,reaction")
      .in("feed_item_id", feedIds);

    if (reactionsError) {
      return jsonError(reactionsError.message, 500);
    }

    for (const reaction of (reactions ?? []) as ReactionRow[]) {
      const existing = reactionsByFeed.get(reaction.feed_item_id) ?? [];
      existing.push(reaction);
      reactionsByFeed.set(reaction.feed_item_id, existing);
    }
  }

  const feed = feedRows.map((item) => {
    const profile = profilesById.get(item.actor_user_id);
    const reactionCounts = reactionTypes.reduce(
      (counts, reaction) => ({ ...counts, [reaction]: 0 }),
      {} as Record<ReactionType, number>
    );
    const reactionUsers = reactionTypes.reduce(
      (users, reaction) => ({ ...users, [reaction]: [] }),
      {} as Record<ReactionType, ReactionUser[]>
    );
    const myReactions: ReactionType[] = [];

    for (const reaction of reactionsByFeed.get(item.id) ?? []) {
      const reactingMember = membersByUserId.get(reaction.user_id);
      const reactingProfile = profilesById.get(reaction.user_id);

      reactionCounts[reaction.reaction] += 1;
      reactionUsers[reaction.reaction].push({
        userId: reaction.user_id,
        displayName: reactingMember
          ? displayNameFor(reactingMember, reactingProfile)
          : reactingProfile?.nickname ||
            reactingProfile?.full_name ||
            reactingProfile?.email?.split("@")[0] ||
            "Member",
        avatarUrl: reactingProfile?.avatar_url ?? null,
        isMe: reaction.user_id === auth.user.id
      });

      if (reaction.user_id === auth.user.id) {
        myReactions.push(reaction.reaction);
      }
    }

    for (const reaction of reactionTypes) {
      reactionUsers[reaction].sort((left, right) => {
        if (left.isMe !== right.isMe) {
          return left.isMe ? -1 : 1;
        }
        return left.displayName.localeCompare(right.displayName);
      });
    }

    const ownReactions = reactionTypes.filter((reaction) => myReactions.includes(reaction));

    return {
      id: item.id,
      actorUserId: item.actor_user_id,
      actorMemberId: item.actor_member_id,
      actorName:
        profile?.nickname || profile?.full_name || profile?.email?.split("@")[0] || "Member",
      actorAvatarUrl: profile?.avatar_url ?? null,
      kind: item.kind,
      recordedOn: item.recorded_on,
      previousDeltaKg: numberOrNull(item.previous_delta_kg),
      newDeltaKg: numberOrNull(item.new_delta_kg),
      createdAt: item.created_at,
      reactionCounts,
      reactionUsers,
      myReactions: ownReactions,
      myReaction: ownReactions[0] ?? null
    };
  });

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
    feed
  });
}
