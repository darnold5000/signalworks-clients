import { NextResponse } from "next/server";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";

/** @deprecated Proposals become sent only after a successful recipient delivery. */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Publishing is now part of Send Proposal. Select recipients and send the draft when it is ready." },
    { status: 409 },
  );
}
