import { NextResponse } from "next/server";
import { sendProposalToClient } from "@/lib/admin/send-proposal-service";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, offerId } = await params;
  const result = await sendProposalToClient({
    tenantId,
    offerId,
    actorUserId: profile.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: result.message,
    email: result.email,
    deliveryMethod: result.deliveryMethod,
    portalLink: result.portalLink,
  });
}
