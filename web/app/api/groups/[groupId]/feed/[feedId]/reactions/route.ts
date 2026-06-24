import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError, requireMembership } from "../../../../../_lib/server";

type ReactionType = "like" | "heart" | "care" | "thumbs_down";

type RouteContext = {
  params: Promise<{
    groupId: string;
    feedId: string;
  }>;
};

const reactions = new Set<ReactionType>(["like", "heart", "care", "thumbs_down"]);

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) {
    return auth;
  }

  const { groupId, feedId } = await context.params;
  const membership = await requireMembership(auth.admin, groupId, auth.user.id);

  if (!membership) {
    return jsonError("Group not found.", 404, "GROUP_NOT_FOUND");
  }

  const body = await request.json().catch(() => ({}));
  const reaction = body.reaction as ReactionType;

  if (!reactions.has(reaction)) {
    return jsonError("Reaction is required.", 422, "REACTION_REQUIRED");
  }

  const { data: feedItem, error: feedError } = await auth.admin
    .from("slim_feed_items")
    .select("id")
    .eq("id", feedId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (feedError) {
    return jsonError(feedError.message, 500);
  }

  if (!feedItem) {
    return jsonError("Feed item not found.", 404, "FEED_NOT_FOUND");
  }

  const { data: existing, error: existingError } = await auth.admin
    .from("slim_feed_reactions")
    .select("id,reaction")
    .eq("feed_item_id", feedId)
    .eq("user_id", auth.user.id)
    .eq("reaction", reaction)
    .maybeSingle();

  if (existingError) {
    return jsonError(existingError.message, 500);
  }

  if (existing?.reaction === reaction) {
    const { error: deleteError } = await auth.admin
      .from("slim_feed_reactions")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return jsonError(deleteError.message, 500);
    }

    return NextResponse.json({ ok: true, reaction, active: false });
  }

  const { error: insertError } = await auth.admin.from("slim_feed_reactions").insert({
    feed_item_id: feedId,
    user_id: auth.user.id,
    reaction,
    updated_at: new Date().toISOString()
  });

  if (insertError) {
    return jsonError(insertError.message, insertError.code === "23505" ? 409 : 500);
  }

  return NextResponse.json({ ok: true, reaction, active: true });
}
