import { NextRequest, NextResponse } from "next/server";
import { cleanText, getAuthContext, isAuthContext, jsonError } from "../../../_lib/server";

type RouteContext = {
  params: Promise<{
    groupId: string;
  }>;
};

function joinRequestsUnavailable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("slim_group_join_requests");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const message = cleanText(body.message, 180);

  const { data: group, error: groupError } = await auth.admin
    .from("slim_groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    return jsonError(groupError.message, 500);
  }

  if (!group) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const { data: existingMember, error: memberError } = await auth.admin
    .from("slim_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memberError) {
    return jsonError(memberError.message, 500);
  }

  if (existingMember) {
    return NextResponse.json({ status: "member" });
  }

  const { data: existingRequest, error: requestReadError } = await auth.admin
    .from("slim_group_join_requests")
    .select("id,status")
    .eq("group_id", groupId)
    .eq("requester_user_id", auth.user.id)
    .maybeSingle();

  if (requestReadError) {
    if (joinRequestsUnavailable(requestReadError)) {
      return jsonError(
        "Join requests need the latest Supabase migration.",
        503,
        "JOIN_REQUESTS_NOT_READY"
      );
    }
    return jsonError(requestReadError.message, 500);
  }

  if (existingRequest?.status === "pending") {
    return NextResponse.json({ status: "pending", requestId: existingRequest.id });
  }

  const requestedAt = new Date().toISOString();

  if (existingRequest) {
    const { data, error } = await auth.admin
      .from("slim_group_join_requests")
      .update({
        status: "pending",
        message,
        requested_at: requestedAt,
        decided_at: null,
        decided_by: null,
        updated_at: requestedAt
      })
      .eq("id", existingRequest.id)
      .select("id")
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ status: "pending", requestId: data.id });
  }

  const { data, error } = await auth.admin
    .from("slim_group_join_requests")
    .insert({
      group_id: groupId,
      requester_user_id: auth.user.id,
      message
    })
    .select("id")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ status: "pending", requestId: data.id }, { status: 201 });
}
