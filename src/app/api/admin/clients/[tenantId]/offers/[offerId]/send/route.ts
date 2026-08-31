import { NextResponse } from "next/server";
import { sendProposalToClient } from "@/lib/admin/send-proposal-service";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({ contactIds: z.array(z.string().uuid()).min(1).max(25) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, offerId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one valid proposal recipient." }, { status: 400 });
  }
  const result = await sendProposalToClient({
    tenantId,
    offerId,
    actorUserId: profile.id,
    contactIds: parsed.data.contactIds,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: result.message,
    deliveries: result.deliveries,
  });
}
