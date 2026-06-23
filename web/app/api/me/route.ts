import { NextRequest, NextResponse } from "next/server";
import { cleanText, getAuthContext, isAuthContext, jsonError } from "../_lib/server";

export async function GET(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const { data, error } = await context.admin
    .from("slim_profiles")
    .select("id,email,full_name,nickname,avatar_url,locale")
    .eq("id", context.user.id)
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      locale: data.locale
    }
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const body = await request.json().catch(() => ({}));
  const locale = body.locale === "zh" || body.locale === "en" ? body.locale : null;

  const { data, error } = await context.admin
    .from("slim_profiles")
    .update({
      full_name: cleanText(body.fullName, 80),
      nickname: cleanText(body.nickname, 40),
      avatar_url: cleanText(body.avatarUrl, 500),
      locale,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.user.id)
    .select("id,email,full_name,nickname,avatar_url,locale")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      locale: data.locale
    }
  });
}
