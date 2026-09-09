import type Stripe from "stripe";
import type { Purchase } from "@/lib/database/phase1-types";
import type { OfferCheckoutStage } from "@/lib/offers/checkout";

export type PurchaseCheckoutState = NonNullable<Purchase["checkout_state"]>;

export function checkoutSessionIdForStage(
  purchase: Purchase,
  stage: OfferCheckoutStage,
): string | null {
  if (stage.cadence === "month") {
    return purchase.monthly_checkout_session_id ?? null;
  }
  if (stage.cadence === "year") {
    return purchase.annual_checkout_session_id ?? null;
  }
  return purchase.stripe_checkout_session_id;
}

export function checkoutSessionColumn(
  stage: OfferCheckoutStage,
): "monthly_checkout_session_id" | "annual_checkout_session_id" | null {
  if (stage.cadence === "month") return "monthly_checkout_session_id";
  if (stage.cadence === "year") return "annual_checkout_session_id";
  return null;
}

export function checkoutStateAfterCompletedStage(args: {
  cadence: OfferCheckoutStage["cadence"];
  finalStage: boolean;
}): PurchaseCheckoutState {
  if (args.finalStage) return "complete";
  if (args.cadence === "month") return "monthly_complete";
  if (args.cadence === "year") return "annual_complete";
  return "complete";
}

export function checkoutStateBeforeStage(
  stages: OfferCheckoutStage[],
  stageIndex: number,
): PurchaseCheckoutState {
  if (stageIndex <= 0) return "pending";
  const previous = stages[stageIndex - 1];
  if (previous?.cadence === "month") return "monthly_complete";
  if (previous?.cadence === "year") return "annual_complete";
  return "pending";
}

export function checkoutSessionCompleted(
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">,
): boolean {
  return session.status === "complete" && session.payment_status !== "unpaid";
}
