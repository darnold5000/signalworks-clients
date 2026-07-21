import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAgreementAcceptance } from "@/lib/agreements/service";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";

const bodySchema = z.object({
  acceptedName: z.string().trim().min(2).max(200),
  acceptedEmail: z.string().trim().email(),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const offer = await getActiveOfferForTenant(client.id);
  if (!offer) {
    return NextResponse.json({ error: "No active offer" }, { status: 404 });
  }

  if (!offer.requires_terms_acceptance || !offer.terms_document_id) {
    return NextResponse.json({ error: "Terms acceptance not required" }, { status: 400 });
  }

  const document = await getLegalDocument(offer.terms_document_id);
  if (!document) {
    return NextResponse.json({ error: "Terms document not found" }, { status: 404 });
  }

  const acceptance = await recordAgreementAcceptance({
    tenantId: client.id,
    userId: profile.id,
    offerId: offer.id,
    document,
    acceptedName: parsed.data.acceptedName,
    acceptedEmail: parsed.data.acceptedEmail,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ acceptance });
}
