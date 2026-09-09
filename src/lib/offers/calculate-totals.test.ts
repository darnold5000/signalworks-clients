import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateArrCents,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { bundledProductMetadata } from "@/lib/offers/offer-item-metadata";

function lineItem(
  partial: Partial<ClientOfferItem> &
    Pick<ClientOfferItem, "item_type" | "unit_amount_cents" | "billing_type">,
): ClientOfferItem {
  return {
    id: "item-1",
    offer_id: "offer-1",
    tenant_id: "tenant-1",
    name: "Line",
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
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("calculateOfferTotals", () => {
  it("stores 0 initial_total for recurring-only offers", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
    ]);

    expect(totals.initial_total_cents).toBe(0);
    expect(totals.recurring_total_cents).toBe(14900);
    expect(totals.annual_recurring_total_cents).toBe(0);
    expect(calculateAmountDueFirstCycle(totals)).toBe(14900);
  });

  it("keeps annual-only recurring charges out of MRR", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "custom_service",
        unit_amount_cents: 2500,
        billing_type: "recurring",
        billing_interval: "year",
      }),
    ]);

    expect(totals.recurring_total_cents).toBe(0);
    expect(totals.annual_recurring_total_cents).toBe(2500);
    expect(calculateAmountDueFirstCycle(totals)).toBe(2500);
    expect(calculateArrCents(totals)).toBe(2500);
  });

  it("keeps mixed monthly, annual, and one-time charges separate", () => {
    const totals = calculateOfferTotals([
      lineItem({ item_type: "base_plan", unit_amount_cents: 6500, billing_type: "recurring" }),
      lineItem({ item_type: "add_on", unit_amount_cents: 2500, billing_type: "recurring", billing_interval: "year" }),
      lineItem({ item_type: "setup_fee", unit_amount_cents: 10000, billing_type: "one_time" }),
      lineItem({ item_type: "product", unit_amount_cents: 0, billing_type: "recurring" }),
    ]);

    expect(totals).toMatchObject({
      recurring_total_cents: 6500,
      annual_recurring_total_cents: 2500,
      initial_total_cents: 10000,
    });
    expect(calculateAmountDueFirstCycle(totals)).toBe(19000);
    expect(calculateArrCents(totals)).toBe(80500);
  });

  it("tracks one-time charges in initial_total only", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
      lineItem({
        item_type: "setup_fee",
        unit_amount_cents: 250000,
        billing_type: "one_time",
      }),
    ]);

    expect(totals.initial_total_cents).toBe(250000);
    expect(totals.recurring_total_cents).toBe(14900);
    expect(calculateAmountDueFirstCycle(totals)).toBe(264900);
  });

  it("excludes bundled product entitlements from monetary totals", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
      lineItem({
        item_type: "product",
        unit_amount_cents: 0,
        billing_type: "recurring",
        metadata: bundledProductMetadata("online_booking"),
      }),
    ]);

    expect(totals.subtotal_cents).toBe(14900);
    expect(totals.recurring_total_cents).toBe(14900);
    expect(totals.initial_total_cents).toBe(0);
  });

  it("applies offer-level discounts to the first-cycle due amount", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
      lineItem({
        item_type: "discount",
        unit_amount_cents: 4900,
        billing_type: "one_time",
      }),
    ]);

    expect(totals.discount_total_cents).toBe(4900);
    expect(totals.initial_total_cents).toBe(0);
    expect(totals.recurring_total_cents).toBe(14900);
    expect(calculateAmountDueFirstCycle(totals)).toBe(10000);
  });

  it("applies recurring-scoped discounts to MRR", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
      lineItem({
        item_type: "discount",
        unit_amount_cents: 4900,
        billing_type: "one_time",
        metadata: { discount_scope: "recurring" },
      }),
    ]);

    expect(totals.discount_total_cents).toBe(0);
    expect(totals.recurring_total_cents).toBe(10000);
    expect(calculateAmountDueFirstCycle(totals)).toBe(10000);
  });

  it("applies monthly discounts independently of line-item order", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "discount",
        unit_amount_cents: 4900,
        billing_type: "one_time",
        metadata: { discount_scope: "recurring" },
      }),
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 14900,
        billing_type: "recurring",
      }),
    ]);

    expect(totals.recurring_total_cents).toBe(10000);
  });

  it("does not let a first-cycle discount spill into the annual stage", () => {
    const totals = calculateOfferTotals([
      lineItem({
        item_type: "discount",
        unit_amount_cents: 20000,
        billing_type: "one_time",
      }),
      lineItem({
        item_type: "base_plan",
        unit_amount_cents: 10000,
        billing_type: "recurring",
      }),
      lineItem({
        item_type: "add_on",
        unit_amount_cents: 2500,
        billing_type: "recurring",
        billing_interval: "year",
      }),
    ]);

    expect(calculateAmountDueFirstCycle(totals)).toBe(2500);
  });
});
