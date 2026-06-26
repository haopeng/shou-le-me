import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type AuthContext = {
  admin: SupabaseClient;
  user: User;
};

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

export function hasServerConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://") &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function isStatusAdmin(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = (process.env.STATUS_ADMIN_EMAILS || "haopengz@gmail.com")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(normalizedEmail);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function roundTenth(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

export function cleanText(value: unknown, max = 120) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, max) : null;
}

export function requireDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

export function requirePositiveWeight(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 20 || number > 400) {
    return null;
  }
  return Math.round(number * 10) / 10;
}

export function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function normalizeInviteCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 5 && code.length <= 24 ? code : null;
}

export function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return adminClient;
}

function getAuthClient() {
  if (!authClient) {
    authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return authClient;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | NextResponse> {
  if (!hasServerConfig()) {
    return jsonError("Supabase environment variables are missing.", 503, "SUPABASE_NOT_CONFIGURED");
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    return jsonError("Sign in required.", 401, "UNAUTHORIZED");
  }

  const { data, error } = await getAuthClient().auth.getUser(token);

  if (error || !data.user) {
    return jsonError("Sign in required.", 401, "UNAUTHORIZED");
  }

  const admin = getAdminClient();

  await admin.from("slim_profiles").upsert(
    {
      id: data.user.id,
      email: data.user.email ?? null,
      full_name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
      avatar_url: (data.user.user_metadata?.avatar_url as string | undefined) ?? null
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  return { admin, user: data.user };
}

export function isAuthContext(value: AuthContext | NextResponse): value is AuthContext {
  return !(value instanceof NextResponse);
}

export async function requireMembership(
  admin: SupabaseClient,
  groupId: string,
  userId: string
) {
  const { data, error } = await admin
    .from("slim_group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
