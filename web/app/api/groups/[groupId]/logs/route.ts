import { NextRequest, NextResponse } from "next/server";
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

  const { error } = await auth.admin.from("weight_logs").upsert(
    {
      member_id: membership.id,
      recorded_on: recordedOn,
      weight_kg: weightKg,
      note: cleanText(body.note, 180),
      updated_at: new Date().toISOString()
    },
    { onConflict: "member_id,recorded_on" }
  );

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
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
    .from("weight_logs")
    .delete()
    .eq("member_id", membership.id)
    .eq("recorded_on", recordedOn);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
