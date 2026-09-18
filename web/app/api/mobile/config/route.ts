import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  // This response must only contain browser-safe configuration, never the service key.
  const isPublicKey = publishableKey.startsWith("sb_publishable_") || (() => {
    try {
      return JSON.parse(Buffer.from(publishableKey.split(".")[1], "base64url").toString()).role === "anon";
    } catch { return false; }
  })();
  if (!isPublicKey) {
    return NextResponse.json({ error: "Invalid public configuration." }, { status: 503 });
  }

  let external: Record<string, boolean> = {};
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store"
    });
    if (response.ok) external = (await response.json()).external ?? {};
  } catch { /* Email authentication remains available when provider discovery fails. */ }

  return NextResponse.json({
    supabaseUrl,
    publishableKey,
    googleEnabled: external.google === true,
    appleEnabled: external.apple === true,
    // Enable only after the Apple callback and deletion/revocation flow are verified.
    socialLoginReady: process.env.IOS_SOCIAL_LOGIN_READY === "true",
    minimumVersion: "1.0"
  }, { headers: { "Cache-Control": "no-store" } });
}
