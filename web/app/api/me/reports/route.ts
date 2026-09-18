import { NextRequest, NextResponse } from "next/server";
import { cleanText, getAuthContext, isAuthContext, jsonError, requireMembership } from "../../_lib/server";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!isAuthContext(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  const reason = cleanText(body.reason, 1000);
  const groupId = cleanText(body.groupId, 80);
  const subjectUserId = cleanText(body.subjectUserId, 80);
  const support = body.kind === "support";
  if (!reason || (!support && (!groupId || !subjectUserId))) return jsonError("Report details are required.", 422);
  if (!support && (!await requireMembership(auth.admin, groupId!, auth.user.id) ||
      !await requireMembership(auth.admin, groupId!, subjectUserId!))) {
    return jsonError("Group member not found.", 404);
  }
  // One private report per reporter/subject/day bounds storage abuse without a new table.
  const bucket = "slim-safety-reports";
  const { data: existing } = await auth.admin.storage.getBucket(bucket);
  if (!existing) {
    const { error } = await auth.admin.storage.createBucket(bucket, { public: false, fileSizeLimit: 16384, allowedMimeTypes: ["application/json"] });
    if (error && !/already exists/i.test(error.message)) return jsonError("Reports are temporarily unavailable.", 503);
  } else if (existing.public) {
    return jsonError("Reports are temporarily unavailable.", 503);
  }
  const report = { reporterUserId: auth.user.id, subjectUserId, groupId, kind: support ? "support" : "report", reason, createdAt: new Date().toISOString(), status: "open" };
  const path = `${auth.user.id}/${support ? "support" : subjectUserId}-${new Date().toISOString().slice(0, 10)}.json`;
  const { error } = await auth.admin.storage.from(bucket).upload(path, JSON.stringify(report), { contentType: "application/json", upsert: true });
  if (error) return jsonError("Could not send the report. Please try again.", 500);
  return NextResponse.json({ ok: true });
}
