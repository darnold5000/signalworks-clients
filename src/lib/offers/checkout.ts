import type Stripe from "stripe";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";
import { createPurchaseFromOffer } from "@/lib/purchases/service";
import type { OfferWithItems } from "@/lib/offers/queries";
import { resolveAppUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

function selectedBillableItems(items: ClientOfferItem[]) {
  return items.filter(
    (item) =>
      item.is_selected &&
      item.stripe_price_id &&
      item.item_type !== "discount" &&
      item.item_type !== "credit" &&
      !isEntitlementOfferItem(item),
  );
}

export async function createOfferCheckoutSession(args: {
  offer: OfferWithItems;
  purchaserUserId: string;
  purchaserEmail: string;
  request: Request;
  existingCustomerId?: string | null;
}) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const billable = selectedBillableItems(args.offer.items);
  if (billable.length === 0) {
    throw new Error("Offer has no billable Stripe prices. Publish the offer first.");
  }

  const hasRecurring = billable.some((item) => item.billing_type === "recurring");
  const mode: Stripe.Checkout.SessionCreateParams.Mode = hasRecurring
    ? "subscription"
    : "payment";

  const { purchase } = await createPurchaseFromOffer({
    offer: args.offer,
    items: args.offer.items,
    purchasedBy: args.purchaserUserId,
  });

  const appUrl = resolveAppUrl(args.request);
  const lineItems = billable.map((item) => ({
    price: item.stripe_price_id!,
    quantity: item.quantity,
  }));

  const couponItem = args.offer.items.find((item) => item.stripe_coupon_id);
  const discounts = couponItem?.stripe_coupon_id
    ? [{ coupon: couponItem.stripe_coupon_id }]
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: lineItems,
    ...(discounts ? { discounts } : {}),
    customer: args.existingCustomerId || undefined,
    customer_email: args.existingCustomerId ? undefined : args.purchaserEmail,
    client_reference_id: args.offer.tenant_id,
    metadata: {
      tenant_id: args.offer.tenant_id,
      offer_id: args.offer.id,
      purchase_id: purchase.id,
    },
    subscription_data: hasRecurring
      ? {
          metadata: {
            tenant_id: args.offer.tenant_id,
            offer_id: args.offer.id,
            purchase_id: purchase.id,
          },
        }
      : undefined,
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/offer`,
  });

  const supabase = createServiceClient();
  await supabase
    .from(TABLES.purchases)
    .update({
      status: "checkout_created",
      stripe_checkout_session_id: session.id,
    })
    .eq("id", purchase.id);

  await supabase
    .from(TABLES.clientOffers)
    .update({ status: "checkout_started" })
    .eq("id", args.offer.id);

  await supabase
    .from(TABLES.tenantProfiles)
    .update({ onboarding_status: "checkout_started" })
    .eq("tenant_id", args.offer.tenant_id);

  return { session, purchaseId: purchase.id };
}
