import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  DISCOUNT_SCOPE,
  discountScopeFromMetadata,
} from "@/lib/offers/discount-scope";

/**
 * Stripe Checkout subscription coupon applied at session creation.
 *
 * Recurring offer discounts are synced via `createCouponForDiscountLine` with:
 * - `duration: "repeating"` and `duration_in_months` when the offer has a term
 * - `amount_off` on the subscription invoice total
 *
 * After the repeating period, Stripe charges line items at their listed prices
 * (full base plan + add-ons). Portal copy should match this model — not a
 * permanently discounted Price object.
 */
export function selectRecurringCheckoutCouponId(
  items: ClientOfferItem[],
): string | null {
  const recurringDiscount = items.find(
    (item) =>
      item.is_selected &&
      item.item_type === "discount" &&
      item.stripe_coupon_id &&
      discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING,
  );

  return recurringDiscount?.stripe_coupon_id ?? null;
}
