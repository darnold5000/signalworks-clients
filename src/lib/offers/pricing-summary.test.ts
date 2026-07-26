import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { paidAddOnMetadata } from "@/lib/offers/offer-item-metadata";
import { buildOfferPricingSummary } from "@/lib/offers/pricing-summary";

function line(
  partial: Partial<ClientOfferItem> &
    Pick<ClientOfferItem, "item_type" | "unit_amount_cents" | "billing_type">,
): ClientOfferItem {
  return {
    id: "1",
    offer_id: "o",
    tenant_id: "t",
    name: partial.name ?? "Line",
    description: null,
    quantity: 1,
    billing_interval: partial.billing_type === "recurring" ? "month" : null,
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
    metadata: partial.metadata ?? {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("buildOfferPricingSummary", () => {
  it("separates standard monthly rate from discounted total", () => {
    const summary = buildOfferPricingSummary([
      line({
        item_type: "base_plan",
        name: "Launch Plan",
        unit_amount_cents: 15900,
        billing_type: "recurring",
      }),
      line({
        item_type: "discount",
        name: "Monthly discount",
        unit_amount_cents: 5000,
        billing_type: "one_time",
        discount_duration_type: "repeating",
        discount_duration_months: 6,
        metadata: { discount_scope: "recurring" },
      }),
    ]);

    expect(summary.standardMonthlyAmountAfterDiscountCents).toBe(15900);
    expect(summary.recurringDiscountAmountCents).toBe(5000);
    expect(summary.discountedMonthlyAmountCents).toBe(10900);
    expect(summary.discountDurationMonths).toBe(6);
    expect(summary.dueAtCheckoutCents).toBe(10900);
  });

  it("includes paid add-ons in standard monthly after discount", () => {
    const summary = buildOfferPricingSummary([
      line({
        item_type: "base_plan",
        unit_amount_cents: 15900,
        billing_type: "recurring",
      }),
      line({
        item_type: "add_on",
        name: "SMS",
        unit_amount_cents: 2900,
        billing_type: "recurring",
        metadata: paidAddOnMetadata("sms_notifications"),
      }),
    ]);

    expect(summary.standardMonthlyAmountAfterDiscountCents).toBe(18800);
    expect(summary.recurringAddOnAmountCents).toBe(2900);
  });
});
