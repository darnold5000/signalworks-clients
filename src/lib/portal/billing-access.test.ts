import { describe, expect, it } from "vitest";
import type { Client } from "@/lib/types";
import {
  clientChurnedFromPaidSubscription,
  clientHasHealthySubscription,
  clientHasOngoingSubscription,
  clientNeedsOfferCheckout,
} from "@/lib/portal/billing-access";

function client(partial: Partial<Client>): Client {
  return {
    id: "t1",
    business_name: "Test",
    plan_name: "Launch",
    monthly_price_cents: 15900,
    currency: "usd",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: "none",
    current_period_end: null,
    website_status: "live",
    hosting_status: "active",
    ssl_status: "active",
    domain: null,
    website_url: null,
    support_email: null,
    updates_included_per_month: 2,
    updates_used_this_month: 0,
    last_deployment_at: null,
    last_backup_at: null,
    analytics_summary: null,
    ...partial,
  } as Client;
}

describe("billing-access subscription detection", () => {
  it("does not treat canceled subscription id alone as healthy", () => {
    const c = client({
      subscription_status: "canceled",
      stripe_subscription_id: "sub_123",
    });
    expect(clientHasHealthySubscription(c)).toBe(false);
    expect(clientHasOngoingSubscription(c)).toBe(false);
  });

  it("treats past_due as ongoing but not healthy", () => {
    const c = client({
      subscription_status: "past_due",
      stripe_subscription_id: "sub_123",
    });
    expect(clientHasHealthySubscription(c)).toBe(false);
    expect(clientHasOngoingSubscription(c)).toBe(true);
    expect(
      clientNeedsOfferCheckout(c, {
        hasActiveOffer: true,
        nextAction: "complete_checkout",
      }),
    ).toBe(false);
  });

  it("suppresses offer checkout for incomplete subscription with id", () => {
    const c = client({
      subscription_status: "incomplete",
      stripe_subscription_id: "sub_123",
    });
    expect(
      clientNeedsOfferCheckout(c, {
        hasActiveOffer: true,
        nextAction: "complete_checkout",
      }),
    ).toBe(false);
  });

  it("blocks self-serve offer checkout after churn", () => {
    const c = client({
      subscription_status: "canceled",
      stripe_subscription_id: "sub_123",
      stripe_customer_id: "cus_123",
    });
    expect(clientChurnedFromPaidSubscription(c)).toBe(true);
    expect(
      clientNeedsOfferCheckout(c, {
        hasActiveOffer: true,
        nextAction: "complete_checkout",
      }),
    ).toBe(false);
  });
});
