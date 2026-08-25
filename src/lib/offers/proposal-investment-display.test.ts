import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  firstCycleDiscountMetadata,
  recurringMonthlyDiscountMetadata,
} from "@/lib/offers/discount-scope";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import {
  discountLineAmountCents,
  formatClientDiscountAmountLabel,
  formatClientDiscountDurationNote,
  formatClientDiscountSecondaryNote,
  groupProposalInvestmentItems,
  proposalInvestmentHasDiscountLines,
} from "@/lib/offers/proposal-investment-display";

function lineItem(
  overrides: Partial<ClientOfferItem> = {},
): ClientOfferItem {
  return {
    id: overrides.id ?? `item-${Math.random()}`,
    offer_id: "offer",
    tenant_id: "tenant",
    item_type: "base_plan",
    name: "Base plan",
    description: null,
    quantity: 1,
    unit_amount_cents: 10000,
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
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function discountLine(
  overrides: Partial<ClientOfferItem> = {},
): ClientOfferItem {
  return lineItem({
    item_type: "discount",
    name: "Founding Partner Discount",
    billing_type: "one_time",
    billing_interval: null,
    unit_amount_cents: 5000,
    discount_type: "amount",
    discount_amount_cents: 5000,
    metadata: recurringMonthlyDiscountMetadata(),
    ...overrides,
  });
}

describe("groupProposalInvestmentItems", () => {
  it("nests discount lines under the preceding billable item", () => {
    const product = lineItem({
      id: "product",
      name: "MA5 Connect",
      unit_amount_cents: 10999,
      sort_order: 0,
    });
    const discount = discountLine({
      id: "discount",
      sort_order: 1,
    });

    const layout = groupProposalInvestmentItems([product, discount]);

    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0]?.billable.id).toBe("product");
    expect(layout.groups[0]?.discounts.map((row) => row.id)).toEqual([
      "discount",
    ]);
    expect(layout.orphanDiscounts).toEqual([]);
  });

  it("keeps orphan discounts when no billable line precedes them", () => {
    const discount = discountLine({ id: "orphan", sort_order: 0 });

    const layout = groupProposalInvestmentItems([discount]);

    expect(layout.groups).toEqual([]);
    expect(layout.orphanDiscounts.map((row) => row.id)).toEqual(["orphan"]);
  });
});

describe("formatClientDiscountAmountLabel", () => {
  it("shows recurring discounts as negative monthly amounts", () => {
    expect(
      formatClientDiscountAmountLabel(
        discountLine({ unit_amount_cents: 5000 }),
        "usd",
      ),
    ).toBe("-$50.00/month");
  });

  it("shows first-cycle discounts as one-time negative amounts", () => {
    expect(
      formatClientDiscountAmountLabel(
        discountLine({
          unit_amount_cents: 2500,
          metadata: firstCycleDiscountMetadata(),
        }),
        "usd",
      ),
    ).toBe("-$25.00");
  });
});

describe("formatClientDiscountDurationNote", () => {
  it("describes repeating recurring discounts", () => {
    expect(
      formatClientDiscountDurationNote(
        discountLine({
          discount_duration_type: "repeating",
          discount_duration_months: 3,
        }),
      ),
    ).toBe("First 3 months");
  });

  it("describes forever recurring discounts as ongoing", () => {
    expect(
      formatClientDiscountDurationNote(
        discountLine({
          discount_duration_type: "forever",
          discount_duration_months: null,
        }),
      ),
    ).toBe("Ongoing");
  });

  it("omits ongoing label when a forever recurring discount has a description", () => {
    expect(
      formatClientDiscountDurationNote(
        discountLine({
          discount_duration_type: "forever",
          description: "Ongoing founding partner pricing",
        }),
      ),
    ).toBeNull();
    expect(
      formatClientDiscountSecondaryNote(
        discountLine({
          discount_duration_type: "forever",
          description: "Ongoing founding partner pricing",
        }),
      ),
    ).toBe("Ongoing founding partner pricing");
  });

  it("describes first-cycle discounts", () => {
    expect(
      formatClientDiscountDurationNote(
        discountLine({ metadata: firstCycleDiscountMetadata() }),
      ),
    ).toBe("First billing cycle");
  });
});

describe("formatClientDiscountSecondaryNote", () => {
  it("returns description for forever recurring discounts", () => {
    expect(
      formatClientDiscountSecondaryNote(
        discountLine({
          discount_duration_type: "forever",
          description: "Ongoing founding partner pricing",
        }),
      ),
    ).toBe("Ongoing founding partner pricing");
  });

  it("returns null when no description is provided", () => {
    expect(
      formatClientDiscountSecondaryNote(
        discountLine({ discount_duration_type: "forever" }),
      ),
    ).toBeNull();
  });
});

describe("proposal investment totals parity", () => {
  it("keeps calculated totals unchanged when discount lines are present", () => {
    const items = [
      lineItem({
        id: "product",
        unit_amount_cents: 10999,
        sort_order: 0,
      }),
      discountLine({
        id: "discount",
        unit_amount_cents: 5000,
        sort_order: 1,
      }),
    ];

    const totals = calculateOfferTotals(items);
    const layout = groupProposalInvestmentItems(items);

    expect(proposalInvestmentHasDiscountLines(layout)).toBe(true);
    expect(discountLineAmountCents(items[1]!)).toBe(5000);
    expect(totals.recurring_total_cents).toBe(5999);
    expect(calculateAmountDueFirstCycle(totals)).toBe(5999);
  });

  it("applies one-time scoped discounts only to due today", () => {
    const items = [
      lineItem({
        unit_amount_cents: 14900,
        sort_order: 0,
      }),
      discountLine({
        unit_amount_cents: 4900,
        metadata: firstCycleDiscountMetadata(),
        sort_order: 1,
      }),
    ];

    const totals = calculateOfferTotals(items);

    expect(totals.recurring_total_cents).toBe(14900);
    expect(calculateAmountDueFirstCycle(totals)).toBe(10000);
  });
});
