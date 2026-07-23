import type { Client } from "@/lib/types";
import type { OnboardingState } from "@/lib/portal/onboarding-state";

export function clientHasActiveSubscription(client: Client): boolean {
  return (
    !client.stripe_subscription_id?.includes("_demo_") &&
    (client.subscription_status === "active" ||
      client.subscription_status === "trialing" ||
      Boolean(client.stripe_subscription_id))
  );
}

export function clientHasStripeCustomer(client: Client): boolean {
  return Boolean(
    client.stripe_customer_id && !client.stripe_customer_id.includes("_demo_"),
  );
}

export function clientCanUseBillingPortal(client: Client): boolean {
  return clientHasStripeCustomer(client);
}

export function clientNeedsOfferCheckout(
  client: Client,
  onboarding: Pick<OnboardingState, "hasActiveOffer" | "nextAction">,
): boolean {
  if (clientHasActiveSubscription(client)) return false;
  if (!onboarding.hasActiveOffer) return false;
  return (
    onboarding.nextAction === "complete_checkout" ||
    onboarding.nextAction === "accept_terms" ||
    onboarding.nextAction === "review_offer" ||
    onboarding.nextAction === "confirm_company"
  );
}
