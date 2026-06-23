import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanText,
  getAuthContext,
  isAuthContext,
  jsonError,
  requireDate,
  requireMembership,
  requirePositiveWeight
} from "../../../_lib/server";

type RouteContext = {
  params: Promise<{
    groupId: string;
  }>;
};

type MembershipRow = {
  id: string;
  group_id: string;
  base_weight_kg: number | string | null;
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

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId } = await context.params;
  const membership = await requireMembership(auth.admin, groupId, auth.user.id);

  if (!membership) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const body = await request.json().catch(() => ({}));
  const recordedOn = requireDate(body.recordedOn);
  const weightKg = requirePositiveWeight(body.weightKg);

  if (!recordedOn || !weightKg) {
    return jsonError("Valid weight and date are required.", 422, "WEIGHT_REQUIRED");
  }

  const beforeLatest = await latestUserLog(auth.admin, auth.user.id);

  const { error } = await auth.admin.from("slim_weight_logs").upsert(
    {
      user_id: auth.user.id,
      recorded_on: recordedOn,
      weight_kg: weightKg,
      note: cleanText(body.note, 180),
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,recorded_on" }
  );

  if (error) {
    return jsonError(error.message, 500);
  }

  const afterLatest = await latestUserLog(auth.admin, auth.user.id);
  let feedCount = 0;

  if (afterLatest?.recorded_on === recordedOn) {
    const { data: memberships, error: membershipError } = await auth.admin
      .from("slim_group_members")
      .select("id,group_id,base_weight_kg")
      .eq("user_id", auth.user.id)
      .not("base_weight_kg", "is", null);

    if (membershipError) {
      return jsonError(membershipError.message, 500);
    }

    const feedRows = ((memberships ?? []) as MembershipRow[])
      .map((readyMembership) => {
        const baseWeight = numberOrNull(readyMembership.base_weight_kg);
        if (baseWeight === null) {
          return null;
        }

        const previousDelta =
          beforeLatest === null
            ? null
            : roundTenth(Number(beforeLatest.weight_kg) - baseWeight);
        const newDelta = roundTenth(Number(afterLatest.weight_kg) - baseWeight);

        if (previousDelta === newDelta) {
          return null;
        }

        const kind: FeedInsertRow["kind"] =
          previousDelta === null ? "first_delta" : "delta_update";

        return {
          group_id: readyMembership.group_id,
          actor_user_id: auth.user.id,
          actor_member_id: readyMembership.id,
          kind,
          recorded_on: recordedOn,
          previous_delta_kg: previousDelta,
          new_delta_kg: newDelta
        };
      })
      .filter(isFeedInsertRow);

    if (feedRows.length) {
      const { error: feedError } = await auth.admin.from("slim_feed_items").insert(feedRows);

      if (feedError) {
        return jsonError(feedError.message, 500);
      }

      feedCount = feedRows.length;
    }
  }

  return NextResponse.json({ ok: true, feedCount });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId } = await context.params;
  const membership = await requireMembership(auth.admin, groupId, auth.user.id);

  if (!membership) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const recordedOn = requireDate(request.nextUrl.searchParams.get("date"));

  if (!recordedOn) {
    return jsonError("Date is required.", 422, "DATE_REQUIRED");
  }

  const { error } = await auth.admin
    .from("slim_weight_logs")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("recorded_on", recordedOn);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
