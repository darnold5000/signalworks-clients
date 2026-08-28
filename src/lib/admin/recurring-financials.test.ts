import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { calculateRecurringFinancials, recurringSourcesFromPurchases } from "@/lib/admin/recurring-financials";
import { recurringMonthlyDiscountMetadata } from "@/lib/offers/discount-scope";

function recurring(name: string, cents: number, interval: "month" | "year" = "month", count = 1): ClientOfferItem {
  return { id: name, name, item_type: "base_plan", billing_type: "recurring", billing_interval: interval, billing_interval_count: count, unit_amount_cents: cents, quantity: 1, is_selected: true, sort_order: 0, metadata: {} } as ClientOfferItem;
}

function discount(cents: number, duration: "forever" | "repeating" = "forever", months: number | null = null): ClientOfferItem {
  return { id: `discount-${cents}`, name: "Discount", item_type: "discount", billing_type: "one_time", billing_interval: null, billing_interval_count: 1, unit_amount_cents: cents, quantity: 1, is_selected: true, sort_order: 1, discount_duration_type: duration, discount_duration_months: months, metadata: recurringMonthlyDiscountMetadata() } as ClientOfferItem;
}

describe("recurring financial reporting", () => {
  it("calculates 49.99 - 10.99 as 39.00 ongoing MRR", () => {
    const result = calculateRecurringFinancials([{ items: [recurring("plan", 4999), discount(1099)] }]);
    expect(result).toMatchObject({ baseRecurringMrrCents: 4999, activeRecurringDiscountMrrCents: 1099, effectiveMrrCents: 3900, discountKind: "ongoing" });
  });

  it("calculates 159.99 - 50.00 as 109.99 while a temporary discount is active", () => {
    const result = calculateRecurringFinancials([{
      items: [recurring("plan", 15999), discount(5000, "repeating", 6)],
      finiteDiscountState: { "discount-5000": { active: true, endsAt: "2027-01-29T00:00:00Z" } },
    }]);
    expect(result).toMatchObject({ effectiveMrrCents: 10999, discountKind: "temporary", discountPeriodsRemaining: null, discountEndsAt: "2027-01-29T00:00:00Z" });
  });

  it("stops reducing MRR after a temporary discount expires", () => {
    const result = calculateRecurringFinancials([{
      items: [recurring("plan", 15999), discount(5000, "repeating", 6)],
      finiteDiscountState: { "discount-5000": { active: false, endsAt: null } },
    }]);
    expect(result.effectiveMrrCents).toBe(15999);
    expect(result.activeRecurringDiscountMrrCents).toBe(0);
  });

  it("normalizes annual and quarterly revenue and sums multiple services", () => {
    const result = calculateRecurringFinancials([{ items: [recurring("annual", 12000, "year"), { ...recurring("quarterly", 30000, "month", 3), sort_order: 1 }] }]);
    expect(result.baseRecurringMrrCents).toBe(11000);
  });

  it("excludes one-time charges and reduces margin by discounts before costs", () => {
    const oneTime = { ...recurring("setup", 50000), billing_type: "one_time" } as ClientOfferItem;
    const result = calculateRecurringFinancials([{ items: [recurring("plan", 4999), discount(1099), oneTime] }], 1000);
    expect(result.effectiveMrrCents).toBe(3900);
    expect(result.effectiveMarginCents).toBe(2900);
  });

  it("does not apply or invent an end for finite discounts with unknown billing state", () => {
    const result = calculateRecurringFinancials([{ items: [recurring("plan", 15999), discount(5000, "repeating", 6)] }]);
    expect(result).toMatchObject({ effectiveMrrCents: 15999, activeRecurringDiscountMrrCents: 0, discountKind: "temporary_unknown", discountEndsAt: null });
  });

  it("does not treat an accepted Proposal Only offer as MRR", () => {
    expect(recurringSourcesFromPurchases([{
      status: "active",
      purchased_at: "2026-08-01T00:00:00Z",
      purchase_snapshot: { offer: { billing_method: "proposal_only" }, items: [recurring("manual", 10000)] },
    }])).toEqual([]);
  });
});
