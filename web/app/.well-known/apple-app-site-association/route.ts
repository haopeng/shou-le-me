import { NextResponse } from "next/server";
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const details = team && /^[A-Z0-9]{10}$/.test(team) ? [{ appIDs: [`${team}.com.haopeng.slimyet`], components: [{ "/": "/join/*" }] }] : [];
  return NextResponse.json({ applinks: { apps: [], details } }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
