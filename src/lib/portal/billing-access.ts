import type { Client } from "@/lib/types";
import type { SubscriptionStatus } from "@/lib/types";
import type { OnboardingState } from "@/lib/portal/onboarding-state";

function isDemoStripeId(id: string | null | undefined): boolean {
  return Boolean(id?.includes("_demo_"));
}

/** Subscription is in good standing for product access messaging. */
export function clientHasHealthySubscription(client: Client): boolean {
  if (isDemoStripeId(client.stripe_subscription_id)) return false;
  return (
    client.subscription_status === "active" ||
    client.subscription_status === "trialing"
  );
}

/** Subscription still exists in Stripe (including past_due or incomplete setup). */
export function clientHasOngoingSubscription(client: Client): boolean {
  if (isDemoStripeId(client.stripe_subscription_id)) return false;

  const status = client.subscription_status;
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due"
  ) {
    return true;
  }

  if (
    status === "incomplete" &&
    client.stripe_subscription_id &&
    !isDemoStripeId(client.stripe_subscription_id)
  ) {
    return true;
  }

  return false;
}

export function clientNeedsPaymentAttention(client: Client): boolean {
  const status = client.subscription_status;
  return (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete"
  );
}

/**
 * Former subscriber — do not reopen self-serve offer/checkout; needs a new agreement.
 */
export function clientChurnedFromPaidSubscription(client: Client): boolean {
  if (isDemoStripeId(client.stripe_subscription_id)) return false;
  if (!client.stripe_subscription_id) return false;
  return (
    client.subscription_status === "canceled" ||
    client.subscription_status === "unpaid"
  );
}

/** Active through period end but scheduled to cancel in Stripe. */
export function clientSubscriptionCancelingAtPeriodEnd(client: Client): boolean {
  return (
    clientHasHealthySubscription(client) &&
    client.cancel_at_period_end === true
  );
}

export function subscriptionStatusTone(
  status: SubscriptionStatus,
): "success" | "warning" | "danger" {
  if (status === "active" || status === "trialing") return "success";
  if (status === "past_due" || status === "incomplete" || status === "unpaid") {
    return "danger";
  }
  if (status === "canceled") return "warning";
  return "warning";
}

/**
 * @deprecated Prefer {@link clientHasHealthySubscription} or {@link clientHasOngoingSubscription}.
 */
export function clientHasActiveSubscription(client: Client): boolean {
  return clientHasHealthySubscription(client);
}

export function clientHasStripeCustomer(client: Client): boolean {
  return Boolean(
    client.stripe_customer_id && !isDemoStripeId(client.stripe_customer_id),
  );
}

export function clientCanUseBillingPortal(client: Client): boolean {
  return clientHasStripeCustomer(client);
}

/** Pre-checkout offer flow — not shown when a Stripe subscription already exists. */
export function clientNeedsOfferCheckout(
  client: Client,
  onboarding: Pick<OnboardingState, "hasActiveOffer" | "nextAction">,
): boolean {
  if (clientChurnedFromPaidSubscription(client)) return false;
  if (clientHasOngoingSubscription(client)) return false;
  if (!onboarding.hasActiveOffer) return false;
  return onboarding.nextAction !== "none";
}
