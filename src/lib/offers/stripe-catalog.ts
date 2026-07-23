import type Stripe from "stripe";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import { getStripe } from "@/lib/stripe";

async function createCouponForItem(
  stripe: Stripe,
  item: ClientOfferItem,
  currency: string,
): Promise<string | null> {
  if (!item.discount_type) return null;

  const params: Stripe.CouponCreateParams = {
    name: `${item.name} discount`,
    duration:
      item.discount_duration_type === "once"
        ? "once"
        : item.discount_duration_type === "forever"
          ? "forever"
          : "repeating",
    metadata: {
      offer_item_id: item.id,
    },
  };

  if (params.duration === "repeating") {
    params.duration_in_months = item.discount_duration_months ?? 6;
  }

  if (item.discount_type === "amount" && item.discount_amount_cents) {
    params.amount_off = item.discount_amount_cents;
    params.currency = currency;
  } else if (item.discount_type === "percent" && item.discount_percent) {
    params.percent_off = Number(item.discount_percent);
  } else {
    return null;
  }

  const coupon = await stripe.coupons.create(params);
  return coupon.id;
}

export async function syncOfferItemToStripe(
  offer: ClientOffer,
  item: ClientOfferItem,
): Promise<{
  stripe_product_id: string;
  stripe_price_id: string;
  stripe_coupon_id: string | null;
}> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const product = await stripe.products.create({
    name: item.name,
    description: item.description ?? undefined,
    metadata: {
      tenant_id: offer.tenant_id,
      offer_id: offer.id,
      offer_item_id: item.id,
      plan_key:
        typeof item.metadata?.plan_key === "string" ? item.metadata.plan_key : "",
      product_key:
        typeof item.metadata?.product_key === "string"
          ? item.metadata.product_key
          : "",
    },
  });

  const priceParams: Stripe.PriceCreateParams = {
    product: product.id,
    currency: offer.currency,
    unit_amount: item.unit_amount_cents,
  };

  if (item.billing_type === "recurring") {
    priceParams.recurring = {
      interval: item.billing_interval ?? "month",
      interval_count: item.billing_interval_count,
    };
  }

  const price = await stripe.prices.create(priceParams);
  const couponId = await createCouponForItem(stripe, item, offer.currency);

  const supabase = createServiceClient();
  await supabase
    .from(TABLES.clientOfferItems)
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      stripe_coupon_id: couponId,
    })
    .eq("id", item.id);

  return {
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    stripe_coupon_id: couponId,
  };
}

export async function syncAllOfferItemsToStripe(offer: ClientOffer, items: ClientOfferItem[]) {
  const billable = items.filter(
    (item) =>
      item.is_selected &&
      item.item_type !== "discount" &&
      item.item_type !== "credit" &&
      !isEntitlementOfferItem(item),
  );

  for (const item of billable) {
    if (!item.stripe_price_id && item.unit_amount_cents > 0) {
      await syncOfferItemToStripe(offer, item);
    }
  }
}
