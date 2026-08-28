import { beforeEach, describe, expect, it, vi } from "vitest";

const getStripe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({ getStripe }));

import {
  calculateStripeBillingState,
  clearStripeBillingSnapshotCacheForTests,
  combineSubscriptionBillingStates,
  loadStripeBillingSnapshot,
  type StripeBillingDiscount,
  type StripeBillingItem,
} from "@/lib/admin/stripe-billing-snapshot";
import {
  calculateRecurringFinancials,
  recurringFinancialsFromStripeSnapshot,
} from "@/lib/admin/recurring-financials";
import type { ClientOfferItem } from "@/lib/database/phase1-types";

function item(args: Partial<StripeBillingItem> & { id: string; amount: number }): StripeBillingItem {
  return {
    subscriptionId: "sub_1",
    subscriptionItemId: args.id,
    priceId: `price_${args.id}`,
    productId: args.productId ?? `prod_${args.id}`,
    productName: args.productName ?? args.id,
    quantity: args.quantity ?? 1,
    unitAmountCents: args.amount,
    interval: args.interval ?? "month",
    intervalCount: args.intervalCount ?? 1,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    itemDiscounts: args.itemDiscounts ?? [],
  };
}

function discount(args: Partial<StripeBillingDiscount> & { id: string }): StripeBillingDiscount {
  return {
    id: args.id,
    name: args.name ?? args.id,
    amountOffCents: args.amountOffCents ?? null,
    percentOff: args.percentOff ?? null,
    duration: args.duration ?? "forever",
    end: args.end ?? null,
    appliesToProductIds: args.appliesToProductIds ?? [],
    scope: args.scope ?? "subscription",
    subscriptionItemId: args.subscriptionItemId ?? null,
    appliedMrrCents: 0,
  };
}

describe("Stripe recurring billing calculation", () => {
  it("calculates one monthly item without a discount", () => {
    expect(calculateStripeBillingState({ items: [item({ id: "plan", amount: 4999 })] }))
      .toMatchObject({ baseMrrCents: 4999, discountMrrCents: 0, effectiveMrrCents: 4999 });
  });

  it("sums multiple monthly items", () => {
    expect(calculateStripeBillingState({ items: [item({ id: "plan", amount: 14999 }), item({ id: "email", amount: 1000 })] }).baseMrrCents)
      .toBe(15999);
  });

  it("normalizes annual items to monthly MRR", () => {
    expect(calculateStripeBillingState({ items: [item({ id: "annual", amount: 12000, interval: "year" })] }).baseMrrCents)
      .toBe(1000);
  });

  it.each([
    ["forever", null],
    ["repeating", "2027-01-01T00:00:00.000Z"],
  ] as const)("applies an active %s amount-off discount", (duration, end) => {
    const result = calculateStripeBillingState({
      items: [item({ id: "plan", amount: 4999 })],
      subscriptionDiscounts: [discount({ id: "save", amountOffCents: 1099, duration, end })],
      nowMs: Date.parse("2026-08-01T00:00:00.000Z"),
    });
    expect(result).toMatchObject({ discountMrrCents: 1099, effectiveMrrCents: 3900 });
  });

  it("applies multiple simultaneous discounts sequentially", () => {
    const result = calculateStripeBillingState({
      items: [item({ id: "plan", amount: 10000 })],
      subscriptionDiscounts: [
        discount({ id: "amount", amountOffCents: 1000 }),
        discount({ id: "percent", percentOff: 10 }),
      ],
    });
    expect(result).toMatchObject({ discountMrrCents: 1900, effectiveMrrCents: 8100 });
  });

  it("applies percentage discounts", () => {
    const result = calculateStripeBillingState({
      items: [item({ id: "plan", amount: 8000 })],
      subscriptionDiscounts: [discount({ id: "half", percentOff: 50 })],
    });
    expect(result.effectiveMrrCents).toBe(4000);
  });

  it("limits product-restricted discounts to eligible recurring products", () => {
    const result = calculateStripeBillingState({
      items: [
        item({ id: "plan", amount: 10000, productId: "prod_plan" }),
        item({ id: "app", amount: 10000, productId: "prod_app" }),
      ],
      subscriptionDiscounts: [
        discount({ id: "app-half", percentOff: 50, appliesToProductIds: ["prod_app"] }),
      ],
    });
    expect(result).toMatchObject({ baseMrrCents: 20000, discountMrrCents: 5000, effectiveMrrCents: 15000 });
  });

  it("applies item-level discounts before subscription discounts", () => {
    const itemDiscount = discount({
      id: "item-save",
      amountOffCents: 2000,
      scope: "item",
      subscriptionItemId: "app",
    });
    const result = calculateStripeBillingState({
      items: [item({ id: "plan", amount: 10000 }), item({ id: "app", amount: 10000, itemDiscounts: [itemDiscount] })],
      subscriptionDiscounts: [discount({ id: "ten-percent", percentOff: 10 })],
    });
    expect(result).toMatchObject({ baseMrrCents: 20000, discountMrrCents: 3800, effectiveMrrCents: 16200 });
  });

  it("models MA5 current and scheduled August 29 billing separately", () => {
    const platformDiscount = discount({ id: "platform", amountOffCents: 5000, duration: "repeating", end: "2027-01-29T00:00:00.000Z" });
    const current = calculateStripeBillingState({
      items: [item({ id: "launch", amount: 14999 }), item({ id: "email", amount: 1000 })],
      subscriptionDiscounts: [platformDiscount],
      nowMs: Date.parse("2026-08-27T00:00:00.000Z"),
    });
    const scheduled = calculateStripeBillingState({
      items: [item({ id: "launch", amount: 14999 }), item({ id: "email", amount: 1000 }), item({ id: "app", amount: 10999 })],
      subscriptionDiscounts: [platformDiscount, discount({ id: "app-save", amountOffCents: 5000 })],
      nowMs: Date.parse("2026-08-27T00:00:00.000Z"),
    });
    const snapshot = combineSubscriptionBillingStates([{
      subscriptionId: "sub_ma5",
      current,
      scheduled: { ...scheduled, effectiveAt: "2026-08-29T00:00:00.000Z" },
    }]);
    expect(snapshot.current).toMatchObject({ baseMrrCents: 15999, discountMrrCents: 5000, effectiveMrrCents: 10999 });
    expect(snapshot.scheduled).toMatchObject({ baseMrrCents: 26998, discountMrrCents: 10000, effectiveMrrCents: 16998 });
  });

  it("detects a scheduled future discount even when items do not change", () => {
    const items = [item({ id: "plan", amount: 10000 })];
    const current = calculateStripeBillingState({ items });
    const scheduled = calculateStripeBillingState({ items, subscriptionDiscounts: [discount({ id: "future", amountOffCents: 2500 })] });
    expect(combineSubscriptionBillingStates([{
      subscriptionId: "sub_1",
      current,
      scheduled: { ...scheduled, effectiveAt: "2026-09-01T00:00:00.000Z" },
    }]).scheduled?.effectiveMrrCents).toBe(7500);
  });

  it("models Sluggers as 49.99 less a forever 10.99 discount", () => {
    const result = calculateStripeBillingState({
      items: [item({ id: "growth", amount: 4999 })],
      subscriptionDiscounts: [discount({ id: "sluggers", amountOffCents: 1099 })],
    });
    expect(result).toMatchObject({ baseMrrCents: 4999, discountMrrCents: 1099, effectiveMrrCents: 3900 });
  });
});

describe("Stripe snapshot fallback", () => {
  beforeEach(() => {
    clearStripeBillingSnapshotCacheForTests();
    getStripe.mockReset();
  });

  it("returns null when Stripe is unavailable so purchase snapshots remain authoritative fallback", async () => {
    getStripe.mockReturnValue(null);
    expect(await loadStripeBillingSnapshot(["sub_unavailable"])).toBeNull();

    const fallback = calculateRecurringFinancials([{ items: [{
      id: "growth",
      name: "Growth",
      item_type: "base_plan",
      billing_type: "recurring",
      billing_interval: "month",
      billing_interval_count: 1,
      unit_amount_cents: 4999,
      quantity: 1,
      is_selected: true,
      sort_order: 0,
      metadata: {},
    } as ClientOfferItem] }]);
    expect(fallback).toMatchObject({ effectiveMrrCents: 4999, source: "purchase_snapshot_fallback" });
  });

  it("returns null when a Stripe subscription is not found", async () => {
    getStripe.mockReturnValue({
      subscriptions: { retrieve: vi.fn().mockRejectedValue(new Error("No such subscription")) },
    });
    await expect(loadStripeBillingSnapshot(["sub_missing"])).resolves.toBeNull();
  });

  it("loads current recurring items without the invalid deep expansion", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: "sub_current",
      items: {
        data: [{
          id: "si_plan",
          quantity: 1,
          current_period_start: 1_787_000_000,
          current_period_end: 1_789_000_000,
          discounts: [],
          price: {
            id: "price_plan",
            unit_amount: 15999,
            recurring: { interval: "month", interval_count: 1 },
            product: { id: "prod_plan", name: "Launch" },
          },
        }],
      },
      discounts: [],
      schedule: null,
      pending_update: null,
    });
    getStripe.mockReturnValue({ subscriptions: { retrieve } });

    const result = await loadStripeBillingSnapshot(["sub_current"]);

    expect(result?.current.baseMrrCents).toBe(15999);
    const expansion = retrieve.mock.calls[0]?.[1]?.expand as string[];
    expect(expansion).toContain("items.data.discounts");
    expect(expansion).not.toContain("items.data.discounts.source.coupon");
  });

  it("loads the next changed subscription schedule phase separately", async () => {
    const now = Math.floor(Date.now() / 1000);
    getStripe.mockReturnValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_schedule",
          items: { data: [{ id: "si_plan", quantity: 1, current_period_start: now - 100, current_period_end: now + 100, discounts: [], price: { id: "price_current", unit_amount: 10000, recurring: { interval: "month", interval_count: 1 }, product: { id: "prod_plan", name: "Plan" } } }] },
          discounts: [],
          schedule: "sched_1",
          pending_update: null,
        }),
      },
      subscriptionSchedules: {
        retrieve: vi.fn().mockResolvedValue({
          phases: [{
            start_date: now + 3600,
            end_date: now + 7200,
            items: [{ price: { id: "price_future", unit_amount: 15000, recurring: { interval: "month", interval_count: 1 }, product: { id: "prod_plan", name: "Plan" } }, quantity: 1, discounts: [] }],
            discounts: [],
          }],
        }),
      },
    });

    const result = await loadStripeBillingSnapshot(["sub_schedule"]);
    expect(result?.current.effectiveMrrCents).toBe(10000);
    expect(result?.scheduled?.effectiveMrrCents).toBe(15000);
  });

  it("detects pending_update recurring items separately from current MRR", async () => {
    const now = Math.floor(Date.now() / 1000);
    getStripe.mockReturnValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_pending",
          items: { data: [{ id: "si_plan", quantity: 1, current_period_start: now - 100, current_period_end: now + 100, discounts: [], price: { id: "price_current", unit_amount: 10000, recurring: { interval: "month", interval_count: 1 }, product: { id: "prod_plan", name: "Plan" } } }] },
          discounts: [],
          schedule: null,
          pending_update: {
            billing_cycle_anchor: now + 3600,
            expires_at: now + 7200,
            subscription_items: [{ id: "si_plan", quantity: 1, current_period_end: now + 7200, discounts: [], price: { id: "price_future", unit_amount: 12500, recurring: { interval: "month", interval_count: 1 }, product: { id: "prod_plan", name: "Plan" } } }],
            discounts: [],
          },
        }),
      },
    });

    const result = await loadStripeBillingSnapshot(["sub_pending"]);
    expect(result?.current.effectiveMrrCents).toBe(10000);
    expect(result?.scheduled?.effectiveMrrCents).toBe(12500);
  });

  it("exposes Stripe as the internal source when a snapshot is converted", () => {
    const current = calculateStripeBillingState({ items: [item({ id: "plan", amount: 1000 })] });
    const financials = recurringFinancialsFromStripeSnapshot({
      source: "stripe",
      subscriptionIds: ["sub_1"],
      subscriptions: [{ subscriptionId: "sub_1", current, scheduled: null }],
      current,
      scheduled: null,
    });
    expect(financials.source).toBe("stripe");
  });
});
