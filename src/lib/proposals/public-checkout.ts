import type Stripe from "stripe";
import { findReusableOfferPurchase } from "@/lib/purchases/service";
import {
  getPublicProposal,
  type PublicProposal,
} from "@/lib/proposals/public-access";

export function isValidProposalAccessToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,100}$/.test(token);
}

export function stripeSessionMatchesProposal(args: {
  session: Pick<Stripe.Checkout.Session, "metadata">;
  offerId: string;
  tenantId: string;
}): boolean {
  return (
    args.session.metadata?.offer_id === args.offerId &&
    args.session.metadata?.tenant_id === args.tenantId
  );
}

export async function getPublicProposalForCheckout(
  token: string,
): Promise<PublicProposal | null> {
  if (!isValidProposalAccessToken(token)) return null;
  const proposal = await getPublicProposal(token);
  if (!proposal) return null;

  const checkoutAllowed =
    Boolean(proposal.recipient.accepted_at) ||
    proposal.offer.status === "checkout_started" ||
    proposal.offer.status === "purchased";
  if (!checkoutAllowed) return null;

  return proposal;
}

export async function resolvePublicCheckoutSessionId(args: {
  token: string;
  sessionIdFromQuery?: string;
}): Promise<
  | { proposal: PublicProposal; sessionId: string }
  | { error: "not_found" | "not_ready" }
> {
  const proposal = await getPublicProposalForCheckout(args.token);
  if (!proposal) return { error: "not_found" };

  if (args.sessionIdFromQuery) {
    return { proposal, sessionId: args.sessionIdFromQuery };
  }

  const purchase = await findReusableOfferPurchase({
    tenantId: proposal.offer.tenant_id,
    offerId: proposal.offer.id,
  });
  if (!purchase) return { error: "not_ready" };

  if (
    purchase.checkout_state === "monthly_complete" &&
    purchase.monthly_checkout_session_id
  ) {
    return { proposal, sessionId: purchase.monthly_checkout_session_id };
  }

  if (
    (purchase.checkout_state === "failed" ||
      purchase.checkout_state === "monthly_complete") &&
    purchase.monthly_checkout_session_id
  ) {
    return { proposal, sessionId: purchase.monthly_checkout_session_id };
  }

  if (purchase.stripe_checkout_session_id) {
    return { proposal, sessionId: purchase.stripe_checkout_session_id };
  }

  return { error: "not_ready" };
}

export async function getPublicProposalCheckoutResume(args: {
  tenantId: string;
  offerId: string;
}): Promise<{
  needsAnnualSetup: boolean;
  needsCheckoutResume: boolean;
  purchaseComplete: boolean;
} | null> {
  const purchase = await findReusableOfferPurchase(args);
  if (!purchase) return null;

  const purchaseComplete =
    purchase.checkout_state === "complete" ||
    purchase.status === "active" ||
    purchase.status === "paid";
  const needsAnnualSetup =
    !purchaseComplete &&
    (purchase.checkout_state === "monthly_complete" ||
      (purchase.checkout_state === "failed" &&
        Boolean(purchase.annual_checkout_session_id))) &&
    (purchase.annual_recurring_total_cents ?? 0) > 0;

  return {
    needsAnnualSetup,
    needsCheckoutResume:
      !purchaseComplete &&
      (needsAnnualSetup ||
        purchase.checkout_state === "pending" ||
        purchase.checkout_state === "failed"),
    purchaseComplete,
  };
}
