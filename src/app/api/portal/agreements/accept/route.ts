import { NextResponse } from "next/server";
import { z } from "zod";
import { recordOfferAgreementsAcceptance } from "@/lib/agreements/service";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";

const bodySchema = z.object({
  acceptedName: z.string().trim().min(2).max(200),
  acceptedEmail: z.string().trim().email(),
  acceptTerms: z.boolean(),
  acceptSow: z.boolean(),
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

  const termsRequired =
    offer.requires_terms_acceptance && Boolean(offer.terms_document_id);
  const sowRequired = Boolean(offer.sow_document_id);

  if (termsRequired && !parsed.data.acceptTerms) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service to continue." },
      { status: 400 },
    );
  }

  if (sowRequired && !parsed.data.acceptSow) {
    return NextResponse.json(
      { error: "You must accept the Statement of Work to continue." },
      { status: 400 },
    );
  }

  const termsDocument =
    termsRequired && offer.terms_document_id
      ? await getLegalDocument(offer.terms_document_id)
      : null;
  const sowDocument =
    sowRequired && offer.sow_document_id
      ? await getLegalDocument(offer.sow_document_id)
      : null;

  if (termsRequired && !termsDocument) {
    return NextResponse.json({ error: "Terms document not found" }, { status: 404 });
  }
  if (sowRequired && !sowDocument) {
    return NextResponse.json({ error: "SOW document not found" }, { status: 404 });
  }

  await recordOfferAgreementsAcceptance({
    tenantId: client.id,
    userId: profile.id,
    offerId: offer.id,
    termsDocument,
    sowDocument,
    acceptedName: parsed.data.acceptedName,
    acceptedEmail: parsed.data.acceptedEmail,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
