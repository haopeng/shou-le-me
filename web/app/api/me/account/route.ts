import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError } from "../../_lib/server";

export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "DELETE") return jsonError("Confirm account deletion.", 422);
  const signedInAt = Date.parse(auth.user.last_sign_in_at ?? "");
  if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > 10 * 60_000) {
    return jsonError("Sign in again before deleting your account.", 403, "REAUTH_REQUIRED");
  }
  // Apple accounts require token revocation as well as local account removal.
  // Fail closed until the deployment has that release prerequisite configured.
  if (auth.user.identities?.some((identity) => identity.provider === "apple")) {
    return jsonError("Apple account deletion requires support. Please use Help & Support.", 409, "APPLE_REVOCATION_REQUIRED");
  }

  // Remove every historical avatar, not just the image currently on the profile.
  for (;;) {
    const { data: objects, error } = await auth.admin.storage.from("slim-avatars").list(auth.user.id, { limit: 100 });
    if (error && !/not found/i.test(error.message)) return jsonError("Could not remove account images. Try again.", 500);
    if (!objects?.length) break;
    const { error: removeError } = await auth.admin.storage.from("slim-avatars").remove(objects.map((object) => `${auth.user.id}/${object.name}`));
    if (removeError) return jsonError("Could not remove account images. Try again.", 500);
  }
  // The schema cascades profiles, owned groups, memberships, logs, feeds, and reactions.
  const { error } = await auth.admin.auth.admin.deleteUser(auth.user.id);
  if (error) return jsonError("Could not delete the account. Try again.", 500);
  return NextResponse.json({ ok: true });
}
