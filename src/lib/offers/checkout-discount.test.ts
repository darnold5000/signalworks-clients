import { describe, expect, it } from "vitest";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { selectRecurringCheckoutCouponId } from "@/lib/offers/checkout-discount";
import { recurringMonthlyDiscountMetadata } from "@/lib/offers/discount-scope";

describe("selectRecurringCheckoutCouponId", () => {
  it("prefers recurring discount line coupon", () => {
    const items = [
      {
        is_selected: true,
        item_type: "base_plan",
        stripe_coupon_id: "coupon_wrong",
        metadata: {},
      },
      {
        is_selected: true,
        item_type: "discount",
        stripe_coupon_id: "coupon_recurring",
        metadata: recurringMonthlyDiscountMetadata(),
      },
    ] as unknown as ClientOfferItem[];

    expect(selectRecurringCheckoutCouponId(items)).toBe("coupon_recurring");
  });

  it("does not select an annual-scoped coupon for the monthly stage", () => {
    const items = [
      {
        is_selected: true,
        item_type: "discount",
        stripe_coupon_id: "coupon_annual",
        metadata: { discount_scope: "recurring", billing_interval: "year" },
      },
    ] as unknown as ClientOfferItem[];

    expect(selectRecurringCheckoutCouponId(items)).toBeNull();
  });
});
