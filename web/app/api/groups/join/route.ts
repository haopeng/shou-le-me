import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError, normalizeInviteCode } from "../../_lib/server";

export async function POST(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const body = await request.json().catch(() => ({}));
  const inviteCode = normalizeInviteCode(body.inviteCode);

  if (!inviteCode) {
    return jsonError("Invite code is required.", 422, "INVITE_CODE_REQUIRED");
  }

  const { data: group, error: groupError } = await context.admin
    .from("slim_groups")
    .select("*")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (groupError) {
    return jsonError(groupError.message, 500);
  }

  if (!group) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const { data: existing } = await context.admin
    .from("slim_group_members")
    .select("*")
    .eq("group_id", group.id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await context.admin.from("slim_group_members").insert({
      group_id: group.id,
      user_id: context.user.id,
      role: "member"
    });

    if (insertError) {
      return jsonError(insertError.message, 500);
    }
  }

  return NextResponse.json({ groupId: group.id, inviteCode: group.invite_code });
}
