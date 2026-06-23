import { NextRequest, NextResponse } from "next/server";
import {
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

export async function PATCH(request: NextRequest, context: RouteContext) {
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
  const baseWeightKg = requirePositiveWeight(body.baseWeightKg);
  const baseDate = requireDate(body.baseDate);

  if (!baseWeightKg || !baseDate) {
    return jsonError("Valid base weight and date are required.", 422, "BASE_REQUIRED");
  }

  const { error: updateError } = await auth.admin
    .from("slim_group_members")
    .update({
      base_weight_kg: baseWeightKg,
      base_date: baseDate,
      updated_at: new Date().toISOString()
    })
    .eq("id", membership.id);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  const { error: logError } = await auth.admin.from("slim_weight_logs").upsert(
    {
      user_id: auth.user.id,
      recorded_on: baseDate,
      weight_kg: baseWeightKg,
      note: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,recorded_on" }
  );

  if (logError) {
    return jsonError(logError.message, 500);
  }

  await auth.admin.from("slim_feed_items").insert({
    group_id: groupId,
    actor_user_id: auth.user.id,
    actor_member_id: membership.id,
    kind: "base_set",
    recorded_on: baseDate,
    previous_delta_kg: null,
    new_delta_kg: null
  });

  return NextResponse.json({ ok: true });
}
