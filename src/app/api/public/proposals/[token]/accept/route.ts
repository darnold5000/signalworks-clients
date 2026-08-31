import { NextResponse } from "next/server";
import { z } from "zod";
import { recordOfferAgreementsAcceptance } from "@/lib/agreements/service";
import { buildOfferAcceptanceSnapshot, resolveOfferBillingMethod } from "@/lib/offers/billing-method";
import { createOfferCheckoutSession } from "@/lib/offers/checkout";
import { getPublicProposal } from "@/lib/proposals/public-access";
import { isStripeConfigured } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const bodySchema = z.object({
  acceptedName: z.string().trim().min(2).max(200),
  acceptTerms: z.boolean(),
  acceptSow: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid acceptance." }, { status: 400 });
  const { token } = await params;
  const proposal = await getPublicProposal(token);
  if (!proposal) return NextResponse.json({ error: "Proposal link is invalid or expired." }, { status: 404 });
  const { offer, recipient, terms, sow } = proposal;
  if (offer.status === "accepted" || offer.status === "purchased") {
    return NextResponse.json({ ok: true, accepted: true, checkoutUrl: null });
  }
  if (offer.status !== "draft" && offer.status !== "published" && offer.status !== "viewed") {
    return NextResponse.json({ error: "This proposal cannot be accepted in its current state." }, { status: 409 });
  }
  if (offer.requires_terms_acceptance && terms && !parsed.data.acceptTerms) return NextResponse.json({ error: "You must accept the Terms of Service." }, { status: 400 });
  if (sow && !parsed.data.acceptSow) return NextResponse.json({ error: "You must accept the Statement of Work." }, { status: 400 });

  const snapshot = buildOfferAcceptanceSnapshot({ offer, items: offer.items, acceptedByUserId: null, acceptedName: parsed.data.acceptedName, acceptedEmail: recipient.email });
  await recordOfferAgreementsAcceptance({
    tenantId: offer.tenant_id, userId: null, offerId: offer.id, termsDocument: offer.requires_terms_acceptance ? terms : null, sowDocument: sow,
    acceptedName: parsed.data.acceptedName, acceptedEmail: recipient.email, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent"), acceptanceSnapshot: snapshot,
  });
  const supabase = createServiceClient();
  await supabase.from(TABLES.proposalRecipients).update({ accepted_at: new Date().toISOString() }).eq("id", recipient.id);

  if (resolveOfferBillingMethod(offer) === "proposal_only") {
    return NextResponse.json({ ok: true, accepted: true, billingMethod: "proposal_only", checkoutUrl: null });
  }
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe is not configured. Contact Signal Works to complete billing setup." }, { status: 503 });
  const { data: subscription } = await supabase.from(TABLES.tenantSubscriptions).select("stripe_customer_id").eq("tenant_id", offer.tenant_id).not("stripe_customer_id", "is", null).limit(1).maybeSingle();
  try {
    const { session } = await createOfferCheckoutSession({ offer, purchaserUserId: null, purchaserEmail: recipient.email, request, existingCustomerId: (subscription?.stripe_customer_id as string | null) ?? null });
    return NextResponse.json({ ok: true, accepted: true, billingMethod: "stripe_checkout", checkoutUrl: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start checkout." }, { status: 502 });
  }
}
