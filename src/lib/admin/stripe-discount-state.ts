import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export type FiniteDiscountState = Record<
  string,
  { active: boolean; endsAt: string | null }
>;

async function resolveCoupon(
  stripe: Stripe,
  discount: Stripe.Discount,
): Promise<Stripe.Coupon | null> {
  const coupon = discount.source.coupon;
  if (!coupon) return null;
  if (typeof coupon !== "string") return coupon;
  const retrieved = await stripe.coupons.retrieve(coupon);
  return "deleted" in retrieved && retrieved.deleted ? null : retrieved;
}

/** Read-only Stripe authority for currently attached finite discounts. */
export async function getStripeFiniteDiscountState(
  subscriptionId: string,
  finiteOfferItemIds: string[],
): Promise<FiniteDiscountState | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: [
        "discounts",
        "discounts.source.coupon",
        "items.data.discounts",
      ],
    });
    const discounts = [
      ...subscription.discounts,
      ...subscription.items.data.flatMap((item) => item.discounts),
    ].filter((discount): discount is Stripe.Discount => typeof discount !== "string");

    const result: FiniteDiscountState = {};
    const requested = new Set(finiteOfferItemIds);
    for (const discount of discounts) {
      const coupon = await resolveCoupon(stripe, discount);
      const offerItemId = coupon?.metadata?.offer_item_id;
      if (!offerItemId || !requested.has(offerItemId)) continue;
      result[offerItemId] = {
        active: discount.end == null || discount.end * 1000 > Date.now(),
        endsAt: discount.end ? new Date(discount.end * 1000).toISOString() : null,
      };
    }

    // A successful current-subscription read with no matching attached discount
    // means that known offer discount is no longer active.
    for (const offerItemId of finiteOfferItemIds) {
      result[offerItemId] ??= { active: false, endsAt: null };
    }
    return result;
  } catch (error) {
    console.error(
      "[admin-mrr] Could not read Stripe discount state",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}
