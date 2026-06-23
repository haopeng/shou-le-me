"use client";

import SlimYetGroupApp from "./SlimYetGroupApp";

export default function JoinGroupClient({ code }: { code: string }) {
  return <SlimYetGroupApp inviteCode={code} />;
}
