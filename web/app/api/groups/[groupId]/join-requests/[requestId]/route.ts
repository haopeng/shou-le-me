import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError, requireMembership } from "../../../../_lib/server";

type RouteContext = {
  params: Promise<{
    groupId: string;
    requestId: string;
  }>;
};

type JoinRequestRow = {
  id: string;
  group_id: string;
  requester_user_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId, requestId } = await context.params;
  const membership = await requireMembership(auth.admin, groupId, auth.user.id);

  if (!membership || membership.role !== "owner") {
    return jsonError("Only group owners can approve join requests.", 403, "OWNER_REQUIRED");
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";

  const { data: joinRequest, error: requestError } = await auth.admin
    .from("slim_group_join_requests")
    .select("id,group_id,requester_user_id,status")
    .eq("id", requestId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (requestError) {
    return jsonError(requestError.message, 500);
  }

  if (!joinRequest) {
    return jsonError("Join request not found.", 404, "JOIN_REQUEST_NOT_FOUND");
  }

  const row = joinRequest as JoinRequestRow;
  if (row.status !== "pending") {
    return NextResponse.json({ status: row.status });
  }

  const decidedAt = new Date().toISOString();

  if (action === "approve") {
    const { data: existingMember, error: existingError } = await auth.admin
      .from("slim_group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", row.requester_user_id)
      .maybeSingle();

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    if (!existingMember) {
      const { error: memberError } = await auth.admin.from("slim_group_members").insert({
        group_id: groupId,
        user_id: row.requester_user_id,
        role: "member"
      });

      if (memberError) {
        return jsonError(memberError.message, 500);
      }
    }
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const { error: updateError } = await auth.admin
    .from("slim_group_join_requests")
    .update({
      status: nextStatus,
      decided_at: decidedAt,
      decided_by: auth.user.id,
      updated_at: decidedAt
    })
    .eq("id", requestId);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return NextResponse.json({ status: nextStatus });
}
