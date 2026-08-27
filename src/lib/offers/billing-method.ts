import type {
  ClientOffer,
  ClientOfferItem,
  ProposalBillingMethod,
} from "@/lib/database/phase1-types";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";

export function resolveOfferBillingMethod(
  offer: Pick<ClientOffer, "billing_method">,
): ProposalBillingMethod {
  return offer.billing_method === "proposal_only"
    ? "proposal_only"
    : "stripe_checkout";
}

export function offerBillingMethodLabel(
  offer: Pick<ClientOffer, "billing_method">,
): string {
  return resolveOfferBillingMethod(offer) === "proposal_only"
    ? "Proposal Only"
    : "Stripe Checkout";
}

export function buildOfferAcceptanceSnapshot(args: {
  offer: ClientOffer;
  items: ClientOfferItem[];
  acceptedByUserId: string;
  acceptedName: string;
  acceptedEmail: string;
}) {
  return {
    billing_method: resolveOfferBillingMethod(args.offer),
    offer: args.offer,
    items: args.items,
    totals: calculateOfferTotals(args.items),
    accepted_by_user_id: args.acceptedByUserId,
    accepted_name: args.acceptedName,
    accepted_email: args.acceptedEmail,
    captured_at: new Date().toISOString(),
  };
}

