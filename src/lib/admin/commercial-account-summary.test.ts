import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import type { StripeBillingSnapshot } from "@/lib/admin/stripe-billing-snapshot";
import { resolveCommercialAccountSummary, type CommercialOffer } from "@/lib/admin/commercial-account-summary";

function recurringPlan(amount: number, name = "Launch"): ClientOfferItem {
  return {
    id: "item-1",
    offer_id: "offer-1",
    tenant_id: "tenant-1",
    item_type: "base_plan",
    name,
    description: null,
    quantity: 1,
    unit_amount_cents: amount,
    billing_type: "recurring",
    billing_interval: "month",
    billing_interval_count: 1,
    discount_type: null,
    discount_amount_cents: null,
    discount_percent: null,
    discount_duration_type: null,
    discount_duration_months: null,
    stripe_product_id: null,
    stripe_price_id: null,
    stripe_coupon_id: null,
    is_optional: false,
    is_selected: true,
    sort_order: 0,
    metadata: {},
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

function offer(status: CommercialOffer["status"], items = [recurringPlan(5_000)]): CommercialOffer {
  return {
    id: "offer-1",
    title: "Ton Tavern — Launch",
    status,
    billing_method: "proposal_only",
    accepted_at: status === "accepted" ? "2026-09-01T00:00:00Z" : null,
    acceptance_snapshot: status === "accepted" ? { offer: { title: "Ton Tavern — Launch" }, items } : null,
    created_at: "2026-08-31T00:00:00Z",
    items,
  };
}

const baseArgs = {
  tenantStatus: "active",
  offers: [] as CommercialOffer[],
  purchases: [],
  subscriptions: [],
  stripeSnapshot: null,
  recurringCostsCents: 0,
};

describe("resolveCommercialAccountSummary", () => {
  it("treats the sanitized Ton Tavern bootstrap shape as commercially unestablished", () => {
    const summary = resolveCommercialAccountSummary({
      ...baseArgs,
      subscriptions: [{ subscription_status: "none", stripe_subscription_id: null }],
      // Legacy portal Launch/$0 fields are deliberately not resolver inputs.
    });
    expect(summary).toEqual({
      commercialState: "not_established",
      websiteManagementStatus: "Pending Setup",
      planName: null,
      baseRecurringCents: null,
      currentRecurringCents: null,
      marginCents: null,
      source: "none",
    });
  });

  it("treats a new client-first record with no proposal or billing the same way", () => {
    expect(resolveCommercialAccountSummary(baseArgs)).toMatchObject({
      commercialState: "not_established",
      websiteManagementStatus: "Pending Setup",
      planName: null,
      baseRecurringCents: null,
      currentRecurringCents: null,
      marginCents: null,
    });
  });

  it("distinguishes draft and sent proposals without establishing commercial values", () => {
    expect(resolveCommercialAccountSummary({ ...baseArgs, offers: [offer("draft")] })).toMatchObject({
      websiteManagementStatus: "Proposal Draft",
      planName: null,
    });
    expect(resolveCommercialAccountSummary({ ...baseArgs, offers: [offer("published")] })).toMatchObject({
      websiteManagementStatus: "Proposal Sent",
      baseRecurringCents: null,
    });
  });

  it("uses an accepted $50 recurring agreement but leaves current billing and margin unknown", () => {
    expect(resolveCommercialAccountSummary({ ...baseArgs, offers: [offer("accepted")] })).toMatchObject({
      commercialState: "agreement_accepted",
      websiteManagementStatus: "Billing Setup Pending",
      planName: "Launch",
      baseRecurringCents: 5_000,
      currentRecurringCents: null,
      marginCents: null,
      source: "accepted_agreement",
    });
  });

  it("preserves an explicitly accepted zero-dollar recurring agreement as zero", () => {
    const summary = resolveCommercialAccountSummary({ ...baseArgs, offers: [offer("accepted", [recurringPlan(0, "Community")])] });
    expect(summary.planName).toBe("Community");
    expect(summary.baseRecurringCents).toBe(0);
    expect(summary.currentRecurringCents).toBeNull();
  });

  it("uses an active purchase snapshot as established billing", () => {
    const summary = resolveCommercialAccountSummary({
      ...baseArgs,
      purchases: [{
        status: "paid",
        purchased_at: "2026-09-02T00:00:00Z",
        purchase_snapshot: {
          offer: { title: "Ton Tavern — Launch" },
          items: [recurringPlan(5_000)],
        },
      }],
      recurringCostsCents: 1_000,
    });
    expect(summary).toMatchObject({
      commercialState: "active",
      websiteManagementStatus: "Active",
      planName: "Launch",
      baseRecurringCents: 5_000,
      currentRecurringCents: 5_000,
      marginCents: 4_000,
      source: "purchase",
    });
  });

  it("does not turn a purchase snapshot with no recurring evidence into zero dollars", () => {
    const summary = resolveCommercialAccountSummary({
      ...baseArgs,
      purchases: [{
        status: "active",
        purchased_at: "2026-09-02T00:00:00Z",
        purchase_snapshot: { offer: { title: "One-time project" }, items: [] },
      }],
    });
    expect(summary).toMatchObject({
      baseRecurringCents: null,
      currentRecurringCents: null,
      marginCents: null,
      source: "purchase",
    });
  });

  it("uses active Stripe billing authoritatively and calculates margin", () => {
    const stripeSnapshot: StripeBillingSnapshot = {
      source: "stripe",
      subscriptionIds: ["sub_1"],
      subscriptions: [],
      current: { items: [], baseMrrCents: 5_000, discountMrrCents: 500, effectiveMrrCents: 4_500, discounts: [] },
      scheduled: null,
    };
    const summary = resolveCommercialAccountSummary({
      ...baseArgs,
      offers: [offer("accepted")],
      subscriptions: [{ subscription_status: "active", stripe_subscription_id: "sub_1" }],
      stripeSnapshot,
      recurringCostsCents: 1_000,
    });
    expect(summary).toMatchObject({
      commercialState: "active",
      websiteManagementStatus: "Active",
      planName: "Launch",
      baseRecurringCents: 5_000,
      currentRecurringCents: 4_500,
      marginCents: 3_500,
      source: "stripe",
    });
  });

  it("preserves an explicit active zero-dollar Stripe subscription", () => {
    const stripeSnapshot: StripeBillingSnapshot = {
      source: "stripe",
      subscriptionIds: ["sub_free"],
      subscriptions: [],
      current: { items: [], baseMrrCents: 0, discountMrrCents: 0, effectiveMrrCents: 0, discounts: [] },
      scheduled: null,
    };
    const summary = resolveCommercialAccountSummary({
      ...baseArgs,
      subscriptions: [{ subscription_status: "active", stripe_subscription_id: "sub_free" }],
      stripeSnapshot,
      recurringCostsCents: 0,
    });
    expect(summary).toMatchObject({
      commercialState: "active",
      baseRecurringCents: 0,
      currentRecurringCents: 0,
      marginCents: 0,
      source: "stripe",
    });
  });
});
