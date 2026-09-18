import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const destination = new URL("com.haopeng.slimyet://auth/callback");
  for (const key of ["code", "error", "error_code", "error_description", "type"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: destination.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  });
}
