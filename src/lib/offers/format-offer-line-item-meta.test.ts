import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { recurringMonthlyDiscountMetadata } from "@/lib/offers/discount-scope";
import { formatOfferLineItemSubtitle } from "@/lib/offers/format-offer-line-item-meta";

function discountItem(
  overrides: Partial<ClientOfferItem> = {},
): ClientOfferItem {
  return {
    id: "id",
    offer_id: "offer",
    tenant_id: "tenant",
    item_type: "discount",
    name: "Monthly discount",
    description: null,
    product_key: null,
    quantity: 1,
    unit_amount_cents: 5000,
    billing_type: "one_time",
    billing_interval: null,
    billing_interval_count: 1,
    discount_type: "amount",
    discount_amount_cents: 5000,
    discount_percent: null,
    discount_duration_type: "repeating",
    discount_duration_months: 6,
    stripe_product_id: null,
    stripe_price_id: null,
    stripe_coupon_id: null,
    is_optional: false,
    is_selected: true,
    sort_order: 0,
    metadata: recurringMonthlyDiscountMetadata(),
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("formatOfferLineItemSubtitle", () => {
  it("shows month count for recurring scoped discounts", () => {
    expect(formatOfferLineItemSubtitle(discountItem())).toBe(
      "Recurring · 6 months",
    );
  });

  it("shows ongoing for forever recurring discounts", () => {
    expect(
      formatOfferLineItemSubtitle(
        discountItem({
          discount_duration_type: "forever",
          discount_duration_months: null,
        }),
      ),
    ).toBe("Recurring · ongoing");
  });

  it("shows first cycle for non-recurring discount scope", () => {
    expect(
      formatOfferLineItemSubtitle(
        discountItem({ metadata: { discount_scope: "first_cycle" } }),
      ),
    ).toBe("First billing cycle only");
  });

  it("labels base plan billing", () => {
    expect(
      formatOfferLineItemSubtitle(
        discountItem({
          item_type: "base_plan",
          billing_type: "recurring",
          billing_interval: "month",
          metadata: {},
        }),
      ),
    ).toBe("Base plan · monthly");
  });
});
