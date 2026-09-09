import type Stripe from "stripe";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  selectFirstCycleCheckoutCouponId,
  selectRecurringCheckoutCouponId,
} from "@/lib/offers/checkout-discount";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";
import {
  createPurchaseFromOffer,
  findReusableOfferPurchase,
} from "@/lib/purchases/service";
import type { OfferWithItems } from "@/lib/offers/queries";
import { resolveAppUrl } from "@/lib/site";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import { resolveOfferBillingMethod } from "@/lib/offers/billing-method";
import { recurringCadence, type BillingInterval } from "@/lib/offers/billing-cadence";
import { DISCOUNT_SCOPE, discountScopeFromMetadata } from "@/lib/offers/discount-scope";
import {
  checkoutSessionColumn,
  checkoutSessionCompleted,
  checkoutSessionIdForStage,
  checkoutStateBeforeStage,
} from "@/lib/offers/checkout-state";
import {
  buildOfferCheckoutReturnUrls,
  type OfferCheckoutReturnContext,
} from "@/lib/offers/checkout-return-urls";

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

export type OfferCheckoutStage = {
  cadence: BillingInterval | null;
  items: ClientOfferItem[];
};

/**
 * Stripe Checkout cannot create a mixed-interval subscription. Preserve the
 * hosted flow by creating one immediate Checkout stage per recurring cadence.
 * One-time prices belong to the first stage only, so they are never charged twice.
 */
export function buildOfferCheckoutStages(items: ClientOfferItem[]): OfferCheckoutStage[] {
  const billable = selectedBillableItems(items);
  const oneTime = billable.filter((item) => item.billing_type === "one_time");
  const monthly = billable.filter(
    (item) =>
      item.billing_type === "recurring" &&
      recurringCadence(item).interval === "month",
  );
  const annual = billable.filter(
    (item) =>
      item.billing_type === "recurring" &&
      recurringCadence(item).interval === "year",
  );
  const recurringStages = [
    ...(monthly.length ? [{ cadence: "month" as const, items: monthly }] : []),
    ...(annual.length ? [{ cadence: "year" as const, items: annual }] : []),
  ];

  if (recurringStages.length === 0) {
    return oneTime.length ? [{ cadence: null, items: oneTime }] : [];
  }
  recurringStages[0]!.items = [...recurringStages[0]!.items, ...oneTime];
  return recurringStages;
}

export function assertCheckoutDiscountCompatibility(items: ClientOfferItem[]) {
  const selectedDiscounts = items.filter(
    (item) =>
      item.is_selected &&
      (item.item_type === "discount" || item.item_type === "credit"),
  );
  const monthly = selectedDiscounts.filter(
    (item) => discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING,
  );
  const firstCycle = selectedDiscounts.filter(
    (item) => discountScopeFromMetadata(item) === DISCOUNT_SCOPE.FIRST_CYCLE,
  );
  if (monthly.length > 1 || firstCycle.length > 1 || (monthly.length && firstCycle.length)) {
    throw new Error(
      "Stripe Checkout supports one coupon per billing stage. Use one monthly discount or one first-cycle discount, or choose Proposal Only.",
    );
  }
}

export async function createOfferCheckoutSession(args: {
  offer: OfferWithItems;
  purchaserUserId: string | null;
  purchaserEmail: string;
  request: Request;
  existingCustomerId?: string | null;
  returnContext?: OfferCheckoutReturnContext;
}) {
  if (resolveOfferBillingMethod(args.offer) === "proposal_only") {
    throw new Error("Proposal Only offers cannot create Stripe Checkout sessions.");
  }
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const stages = buildOfferCheckoutStages(args.offer.items);
  if (stages.length === 0) {
    throw new Error("Offer has no billable Stripe prices. Publish the offer first.");
  }
  assertCheckoutDiscountCompatibility(args.offer.items);

  let purchase =
    (await findReusableOfferPurchase({
      tenantId: args.offer.tenant_id,
      offerId: args.offer.id,
    })) ?? null;

  if (!purchase) {
    const created = await createPurchaseFromOffer({
      offer: args.offer,
      items: args.offer.items,
      purchasedBy: args.purchaserUserId,
    });
    purchase = created.purchase;
  }

  let customerId = args.existingCustomerId || undefined;
  const sessionsByStage = new Map<number, Stripe.Checkout.Session>();

  // Backward compatibility for a session created before cadence-specific
  // references were deployed. Its metadata identifies the owning stage.
  if (purchase.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        purchase.stripe_checkout_session_id,
      );
      const existingIndex = Number(
        existing.metadata?.checkout_stage_index ?? 0,
      );
      sessionsByStage.set(existingIndex, existing);
      const existingCustomer =
        typeof existing.customer === "string"
          ? existing.customer
          : existing.customer?.id;
      customerId = existingCustomer ?? customerId;
    } catch {
      // A missing legacy/current reference does not erase cadence-specific refs.
    }
  }

  let stageIndex = 0;
  let sessionToReplace: Stripe.Checkout.Session | null = null;
  let lastCompletedSession: Stripe.Checkout.Session | null = null;
  for (; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex]!;
    let existing = sessionsByStage.get(stageIndex) ?? null;
    const stageSessionId = checkoutSessionIdForStage(purchase, stage);
    if (!existing && stageSessionId) {
      try {
        existing = await stripe.checkout.sessions.retrieve(stageSessionId);
      } catch {
        existing = null;
      }
    }

    if (!existing) break;

    const existingCustomer =
      typeof existing.customer === "string"
        ? existing.customer
        : existing.customer?.id;
    customerId = existingCustomer ?? customerId;

    if (checkoutSessionCompleted(existing)) {
      lastCompletedSession = existing;
      continue;
    }
    if (existing.status === "complete" && purchase.checkout_state !== "failed") {
      throw new Error(
        "Stripe is still confirming this checkout step. Wait a moment, then try again.",
      );
    }
    if (existing.status === "open" && existing.url) {
      return { session: existing, purchaseId: purchase.id };
    }

    sessionToReplace = existing;
    break;
  }

  if (stageIndex >= stages.length && lastCompletedSession) {
    return { session: lastCompletedSession, purchaseId: purchase.id };
  }

  const stage = stages[stageIndex]!;
  const hasRecurring = stage.cadence !== null;
  const mode: Stripe.Checkout.SessionCreateParams.Mode = hasRecurring
    ? "subscription"
    : "payment";
  const appUrl = resolveAppUrl(args.request);
  const lineItems = stage.items.map((item) => ({
    price: item.stripe_price_id!,
    quantity: item.quantity,
  }));
  const couponId =
    stage.cadence === "month"
      ? selectRecurringCheckoutCouponId(args.offer.items)
      : null;
  const firstCycleCouponId =
    stageIndex === 0
      ? selectFirstCycleCheckoutCouponId(args.offer.items)
      : null;
  if (couponId && firstCycleCouponId) {
    throw new Error(
      "Stripe Checkout supports one coupon per billing stage. This proposal combines a monthly discount with a first-cycle discount; remove one or use Proposal Only.",
    );
  }
  const checkoutCouponId = couponId ?? firstCycleCouponId;
  const discounts = checkoutCouponId
    ? [{ coupon: checkoutCouponId }]
    : undefined;
  const finalStage = stageIndex === stages.length - 1;
  const returnUrls = buildOfferCheckoutReturnUrls({
    appUrl,
    finalStage,
    returnContext: args.returnContext,
  });

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: lineItems,
    ...(discounts ? { discounts } : {}),
    customer: customerId,
    customer_email: customerId ? undefined : args.purchaserEmail,
    client_reference_id: args.offer.tenant_id,
    metadata: {
      tenant_id: args.offer.tenant_id,
      offer_id: args.offer.id,
      purchase_id: purchase.id,
      checkout_stage_index: String(stageIndex),
      checkout_stage_count: String(stages.length),
      checkout_stage_cadence: stage.cadence ?? "one_time",
      checkout_stage_final: String(finalStage),
    },
    subscription_data: hasRecurring
      ? {
          metadata: {
            tenant_id: args.offer.tenant_id,
            offer_id: args.offer.id,
            purchase_id: purchase.id,
            checkout_stage_index: String(stageIndex),
            checkout_stage_count: String(stages.length),
            checkout_stage_cadence: stage.cadence ?? "one_time",
            checkout_stage_final: String(finalStage),
          },
        }
      : undefined,
    success_url: returnUrls.success_url,
    cancel_url: returnUrls.cancel_url,
  }, {
    // The same purchase/stage/attempt always resolves to the same Checkout
    // Session, including concurrent browser tabs. A retry after expiration uses
    // the expired Session id as a new, deterministic attempt key.
    idempotencyKey: [
      "offer",
      args.offer.id,
      "checkout-stage",
      String(stageIndex),
      sessionToReplace?.id ?? "initial",
    ].join(":"),
  });

  const supabase = createServiceClient();
  const cadenceSessionColumn = checkoutSessionColumn(stage);
  await supabase
    .from(TABLES.purchases)
    .update({
      status: "checkout_created",
      checkout_state: checkoutStateBeforeStage(stages, stageIndex),
      stripe_checkout_session_id: session.id,
      ...(cadenceSessionColumn ? { [cadenceSessionColumn]: session.id } : {}),
    })
    .eq("id", purchase.id);

  if (stage.cadence) {
    await supabase
      .from(TABLES.purchaseItems)
      .update({ service_status: "pending" })
      .eq("purchase_id", purchase.id)
      .eq("billing_type", "recurring")
      .eq("billing_interval", stage.cadence)
      .eq("service_status", "failed");
  }

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
