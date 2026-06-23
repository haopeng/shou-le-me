import { NextRequest, NextResponse } from "next/server";
import {
  cleanText,
  getAuthContext,
  isAuthContext,
  jsonError,
  makeInviteCode
} from "../_lib/server";

export async function GET(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const { data: memberships, error } = await context.admin
    .from("group_members")
    .select(
      "group_id,role,base_date,base_weight_kg,groups(id,name,description,invite_code,owner_id,created_at)"
    )
    .eq("user_id", context.user.id)
    .order("joined_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  const counts = new Map<string, number>();

  if (groupIds.length) {
    const { data: memberRows, error: countError } = await context.admin
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    if (countError) {
      return jsonError(countError.message, 500);
    }

    for (const row of memberRows ?? []) {
      counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
    }
  }

  const groups = (memberships ?? [])
    .map((membership) => {
      const group = Array.isArray(membership.groups) ? membership.groups[0] : membership.groups;
      if (!group) {
        return null;
      }
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        inviteCode: group.invite_code,
        ownerId: group.owner_id,
        createdAt: group.created_at,
        memberCount: counts.get(group.id) ?? 1,
        myRole: membership.role,
        myBaseReady: membership.base_weight_kg !== null,
        myBaseDate: membership.base_date
      };
    })
    .filter(Boolean);

  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, 80);
  const description = cleanText(body.description, 180);

  if (!name) {
    return jsonError("Group name is required.", 422, "GROUP_NAME_REQUIRED");
  }

  let group = null;
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await context.admin
      .from("groups")
      .insert({
        name,
        description,
        owner_id: context.user.id,
        invite_code: makeInviteCode()
      })
      .select("*")
      .single();

    if (!error) {
      group = data;
      break;
    }

    lastError = error;
    if (!error.message.toLowerCase().includes("duplicate")) {
      break;
    }
  }

  if (!group) {
    return jsonError(lastError?.message ?? "Could not create group.", 500);
  }

  const { error: memberError } = await context.admin.from("group_members").insert({
    group_id: group.id,
    user_id: context.user.id,
    role: "owner"
  });

  if (memberError) {
    return jsonError(memberError.message, 500);
  }

  return NextResponse.json(
    {
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        inviteCode: group.invite_code,
        ownerId: group.owner_id,
        createdAt: group.created_at,
        memberCount: 1,
        myRole: "owner",
        myBaseReady: false,
        myBaseDate: null
      }
    },
    { status: 201 }
  );
}
