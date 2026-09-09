import { NextResponse } from "next/server";
import { createOfferCheckoutSession } from "@/lib/offers/checkout";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import { hasAcceptedRequiredOfferAgreements } from "@/lib/agreements/service";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { isStripeConfigured } from "@/lib/stripe";
import { resolveOfferBillingMethod } from "@/lib/offers/billing-method";
import { checkoutSessionCompleted } from "@/lib/offers/checkout-state";
import { syncClientFromCheckoutSession } from "@/lib/stripe-sync";

function isRealStripeId(id: string | null | undefined): id is string {
  return Boolean(id && !id.includes("_demo_"));
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  const offer = await getActiveOfferForTenant(client.id);
  if (!offer) {
    return NextResponse.json({ error: "No active offer" }, { status: 404 });
  }
  if (resolveOfferBillingMethod(offer) === "proposal_only") {
    return NextResponse.json(
      { error: "This proposal does not use Stripe Checkout." },
      { status: 409 },
    );
  }

  const accepted = await hasAcceptedRequiredOfferAgreements({
    tenantId: client.id,
    offerId: offer.id,
    userId: profile.id,
    termsDocumentId: offer.terms_document_id,
    sowDocumentId: offer.sow_document_id,
    requiresTerms: offer.requires_terms_acceptance,
  });
  if (!accepted) {
    return NextResponse.json(
      {
        error:
          "Accept the Terms of Service and Statement of Work before checkout.",
      },
      { status: 403 },
    );
  }

  try {
    const { session } = await createOfferCheckoutSession({
      offer,
      purchaserUserId: profile.id,
      purchaserEmail: profile.email,
      request,
      existingCustomerId: isRealStripeId(client.stripe_customer_id)
        ? client.stripe_customer_id
        : null,
    });

    if (!session.url && checkoutSessionCompleted(session)) {
      await syncClientFromCheckoutSession(session);
      return NextResponse.json({
        url: `/billing/success?session_id=${encodeURIComponent(session.id)}`,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
