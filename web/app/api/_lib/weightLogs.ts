import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanText } from "./server";

type MembershipRow = {
  id: string;
  group_id: string;
  base_weight_kg: number | string | null;
  base_date: string | null;
};

type WeightLogRow = {
  id: string;
  recorded_on: string;
  weight_kg: number | string;
};

type FeedInsertRow = {
  group_id: string;
  actor_user_id: string;
  actor_member_id: string;
  kind: "first_delta" | "delta_update";
  recorded_on: string;
  previous_delta_kg: number | null;
  new_delta_kg: number;
};

export type WeightLogWriteResult = {
  ok: true;
  updatedGroupCount: number;
  readyGroupCount: number;
  appliedGroupCount: number;
  feedCount: number;
  latestChanged: boolean;
  latestRecordedOn: string | null;
};

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isFeedInsertRow(row: FeedInsertRow | null): row is FeedInsertRow {
  return row !== null;
}

function latestRowsDiffer(before: WeightLogRow | null, after: WeightLogRow | null) {
  if (!before && !after) {
    return false;
  }
  if (!before || !after) {
    return true;
  }
  return before.recorded_on !== after.recorded_on || Number(before.weight_kg) !== Number(after.weight_kg);
}

function membershipAppliesToDate(membership: MembershipRow, recordedOn: string) {
  return (
    numberOrNull(membership.base_weight_kg) !== null &&
    (!membership.base_date || recordedOn >= membership.base_date)
  );
}

async function latestUserLog(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("slim_weight_logs")
    .select("id,recorded_on,weight_kg")
    .eq("user_id", userId)
    .order("recorded_on", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as WeightLogRow | null;
}

async function userMemberships(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("slim_group_members")
    .select("id,group_id,base_weight_kg,base_date")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as MembershipRow[];
}

async function writeDeltaFeedForLatestChange({
  admin,
  userId,
  beforeLatest,
  afterLatest,
  recordedOn,
  memberships
}: {
  admin: SupabaseClient;
  userId: string;
  beforeLatest: WeightLogRow | null;
  afterLatest: WeightLogRow | null;
  recordedOn: string;
  memberships: MembershipRow[];
}) {
  if (!afterLatest || !latestRowsDiffer(beforeLatest, afterLatest)) {
    return 0;
  }

  const feedRows = memberships
    .map((membership) => {
      const baseWeight = numberOrNull(membership.base_weight_kg);
      if (baseWeight === null) {
        return null;
      }

      const afterInScope =
        !membership.base_date || afterLatest.recorded_on >= membership.base_date;
      if (!afterInScope) {
        return null;
      }

      const beforeInScope =
        beforeLatest && (!membership.base_date || beforeLatest.recorded_on >= membership.base_date)
          ? beforeLatest
          : null;
      const previousDelta =
        beforeInScope === null ? null : roundTenth(Number(beforeInScope.weight_kg) - baseWeight);
      const newDelta = roundTenth(Number(afterLatest.weight_kg) - baseWeight);

      if (previousDelta === newDelta) {
        return null;
      }

      return {
        group_id: membership.group_id,
        actor_user_id: userId,
        actor_member_id: membership.id,
        kind: previousDelta === null ? "first_delta" : "delta_update",
        recorded_on: recordedOn,
        previous_delta_kg: previousDelta,
        new_delta_kg: newDelta
      } satisfies FeedInsertRow;
    })
    .filter(isFeedInsertRow);

  if (!feedRows.length) {
    return 0;
  }

  const { error } = await admin.from("slim_feed_items").insert(feedRows);

  if (error) {
    throw error;
  }

  return feedRows.length;
}

export async function saveUserWeightLog({
  admin,
  userId,
  recordedOn,
  weightKg,
  note
}: {
  admin: SupabaseClient;
  userId: string;
  recordedOn: string;
  weightKg: number;
  note: unknown;
}): Promise<WeightLogWriteResult> {
  const beforeLatest = await latestUserLog(admin, userId);

  const { error } = await admin.from("slim_weight_logs").upsert(
    {
      user_id: userId,
      recorded_on: recordedOn,
      weight_kg: weightKg,
      note: cleanText(note, 180),
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,recorded_on" }
  );

  if (error) {
    throw error;
  }

  const [afterLatest, memberships] = await Promise.all([
    latestUserLog(admin, userId),
    userMemberships(admin, userId)
  ]);

  const feedCount = await writeDeltaFeedForLatestChange({
    admin,
    userId,
    beforeLatest,
    afterLatest,
    recordedOn,
    memberships
  });

  return {
    ok: true,
    updatedGroupCount: memberships.length,
    readyGroupCount: memberships.filter((membership) => membership.base_weight_kg !== null).length,
    appliedGroupCount: memberships.filter((membership) =>
      membershipAppliesToDate(membership, recordedOn)
    ).length,
    feedCount,
    latestChanged: latestRowsDiffer(beforeLatest, afterLatest),
    latestRecordedOn: afterLatest?.recorded_on ?? null
  };
}

export async function deleteUserWeightLog({
  admin,
  userId,
  recordedOn
}: {
  admin: SupabaseClient;
  userId: string;
  recordedOn: string;
}): Promise<WeightLogWriteResult> {
  const beforeLatest = await latestUserLog(admin, userId);

  const { error } = await admin
    .from("slim_weight_logs")
    .delete()
    .eq("user_id", userId)
    .eq("recorded_on", recordedOn);

  if (error) {
    throw error;
  }

  const [afterLatest, memberships] = await Promise.all([
    latestUserLog(admin, userId),
    userMemberships(admin, userId)
  ]);

  const feedCount =
    beforeLatest?.recorded_on === recordedOn && afterLatest
      ? await writeDeltaFeedForLatestChange({
          admin,
          userId,
          beforeLatest,
          afterLatest,
          recordedOn: afterLatest.recorded_on,
          memberships
        })
      : 0;

  return {
    ok: true,
    updatedGroupCount: memberships.length,
    readyGroupCount: memberships.filter((membership) => membership.base_weight_kg !== null).length,
    appliedGroupCount: memberships.filter((membership) =>
      membershipAppliesToDate(membership, recordedOn)
    ).length,
    feedCount,
    latestChanged: latestRowsDiffer(beforeLatest, afterLatest),
    latestRecordedOn: afterLatest?.recorded_on ?? null
  };
}
