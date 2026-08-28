import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export type BillingInterval = "day" | "week" | "month" | "year";

export type StripeBillingDiscount = {
  id: string;
  name: string;
  amountOffCents: number | null;
  percentOff: number | null;
  duration: "forever" | "repeating" | "once";
  end: string | null;
  appliesToProductIds: string[];
  scope: "subscription" | "item";
  subscriptionItemId: string | null;
  appliedMrrCents: number;
};

export type StripeBillingItem = {
  subscriptionId: string;
  subscriptionItemId: string;
  priceId: string;
  productId: string;
  productName: string | null;
  quantity: number;
  unitAmountCents: number;
  interval: BillingInterval;
  intervalCount: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  itemDiscounts: StripeBillingDiscount[];
};

export type StripeBillingState = {
  items: StripeBillingItem[];
  baseMrrCents: number;
  discountMrrCents: number;
  effectiveMrrCents: number;
  discounts: StripeBillingDiscount[];
};

export type StripeScheduledBillingState = StripeBillingState & {
  effectiveAt: string;
};

export type StripeBillingSnapshot = {
  source: "stripe";
  subscriptionIds: string[];
  subscriptions: SubscriptionBillingState[];
  current: StripeBillingState;
  scheduled: StripeScheduledBillingState | null;
};

export type SubscriptionBillingState = {
  subscriptionId: string;
  current: StripeBillingState;
  scheduled: StripeScheduledBillingState | null;
};

type CacheEntry = {
  expiresAt: number;
  value: Promise<StripeBillingSnapshot | null>;
};

const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<string, CacheEntry>();

function iso(epoch: number | null | undefined): string | null {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

function intervalMonths(interval: BillingInterval, count: number): number {
  if (interval === "year") return 12 * count;
  if (interval === "month") return count;
  if (interval === "week") return (count * 7) / (365.25 / 12);
  return count / (365.25 / 12);
}

export function normalizeStripeAmountToMrr(
  amountCents: number,
  interval: BillingInterval,
  intervalCount: number,
): number {
  return Math.round(amountCents / intervalMonths(interval, intervalCount));
}

function itemBaseMrr(item: StripeBillingItem): number {
  return normalizeStripeAmountToMrr(
    item.unitAmountCents * item.quantity,
    item.interval,
    item.intervalCount,
  );
}

function discountIsActive(discount: StripeBillingDiscount, nowMs: number): boolean {
  return !discount.end || new Date(discount.end).getTime() > nowMs;
}

function eligibleItemIndexes(
  items: StripeBillingItem[],
  discount: StripeBillingDiscount,
): number[] {
  return items.flatMap((item, index) => {
    if (
      discount.scope === "item" &&
      item.subscriptionItemId !== discount.subscriptionItemId
    ) return [];
    if (
      discount.appliesToProductIds.length > 0 &&
      !discount.appliesToProductIds.includes(item.productId)
    ) return [];
    return [index];
  });
}

function normalizedAmountDiscount(
  amountOffCents: number,
  items: StripeBillingItem[],
  eligibleIndexes: number[],
  discount: StripeBillingDiscount,
): number {
  if (discount.scope === "item" && eligibleIndexes.length === 1) {
    const item = items[eligibleIndexes[0]!]!;
    return normalizeStripeAmountToMrr(
      amountOffCents,
      item.interval,
      item.intervalCount,
    );
  }

  const cadences = new Set(
    eligibleIndexes.map((index) => {
      const item = items[index]!;
      return `${item.interval}:${item.intervalCount}`;
    }),
  );
  if (cadences.size === 1 && eligibleIndexes.length > 0) {
    const item = items[eligibleIndexes[0]!]!;
    return normalizeStripeAmountToMrr(
      amountOffCents,
      item.interval,
      item.intervalCount,
    );
  }

  // Mixed-interval Stripe subscriptions invoice independently. Treat a
  // subscription amount-off as monthly when no single invoice cadence exists.
  return amountOffCents;
}

function applyDiscount(
  items: StripeBillingItem[],
  remaining: number[],
  discount: StripeBillingDiscount,
  nowMs: number,
): StripeBillingDiscount {
  if (!discountIsActive(discount, nowMs)) {
    return { ...discount, appliedMrrCents: 0 };
  }

  const eligible = eligibleItemIndexes(items, discount).filter(
    (index) => remaining[index]! > 0,
  );
  if (eligible.length === 0) return { ...discount, appliedMrrCents: 0 };

  let applied = 0;
  if (discount.percentOff != null) {
    for (const index of eligible) {
      const reduction = Math.min(
        remaining[index]!,
        Math.round((remaining[index]! * discount.percentOff) / 100),
      );
      remaining[index] -= reduction;
      applied += reduction;
    }
  } else if (discount.amountOffCents != null) {
    let amountRemaining = normalizedAmountDiscount(
      discount.amountOffCents,
      items,
      eligible,
      discount,
    );
    for (const index of eligible) {
      const reduction = Math.min(remaining[index]!, amountRemaining);
      remaining[index] -= reduction;
      amountRemaining -= reduction;
      applied += reduction;
      if (amountRemaining <= 0) break;
    }
  }

  return { ...discount, appliedMrrCents: applied };
}

/** Pure Stripe-style recurring calculation. Item discounts precede subscription discounts. */
export function calculateStripeBillingState(args: {
  items: StripeBillingItem[];
  subscriptionDiscounts?: StripeBillingDiscount[];
  nowMs?: number;
}): StripeBillingState {
  const nowMs = args.nowMs ?? Date.now();
  const remaining = args.items.map(itemBaseMrr);
  const appliedDiscounts: StripeBillingDiscount[] = [];

  for (const item of args.items) {
    for (const discount of item.itemDiscounts) {
      appliedDiscounts.push(
        applyDiscount(args.items, remaining, discount, nowMs),
      );
    }
  }
  for (const discount of args.subscriptionDiscounts ?? []) {
    appliedDiscounts.push(
      applyDiscount(args.items, remaining, discount, nowMs),
    );
  }

  const baseMrrCents = args.items.reduce(
    (sum, item) => sum + itemBaseMrr(item),
    0,
  );
  const effectiveMrrCents = remaining.reduce((sum, amount) => sum + amount, 0);

  return {
    items: args.items,
    baseMrrCents,
    discountMrrCents: baseMrrCents - effectiveMrrCents,
    effectiveMrrCents,
    discounts: appliedDiscounts.filter((discount) => discount.appliedMrrCents > 0),
  };
}

function productDetails(price: Stripe.Price): {
  productId: string;
  productName: string | null;
} {
  const product = price.product;
  if (typeof product === "string") return { productId: product, productName: null };
  return {
    productId: product.id,
    productName: "name" in product ? product.name : null,
  };
}

function priceIsRecurring(
  price: Stripe.Price | Stripe.DeletedPrice,
): price is Stripe.Price & { recurring: Stripe.Price.Recurring } {
  return !("deleted" in price && price.deleted) && Boolean(price.recurring);
}

async function retrieveCoupon(
  stripe: Stripe,
  coupon: string | Stripe.Coupon | null,
): Promise<Stripe.Coupon | null> {
  if (!coupon) return null;
  if (typeof coupon !== "string") return coupon;
  const retrieved = await stripe.coupons.retrieve(coupon);
  return "deleted" in retrieved && retrieved.deleted ? null : retrieved;
}

async function retrievePromotionCoupon(
  stripe: Stripe,
  promotion: string | Stripe.PromotionCode | null,
): Promise<Stripe.Coupon | null> {
  if (!promotion) return null;
  const resolved =
    typeof promotion === "string"
      ? await stripe.promotionCodes.retrieve(promotion, { expand: ["promotion.coupon"] })
      : promotion;
  return retrieveCoupon(stripe, resolved.promotion.coupon);
}

function discountFromCoupon(args: {
  id: string;
  coupon: Stripe.Coupon;
  scope: "subscription" | "item";
  subscriptionItemId?: string | null;
  end?: number | null;
}): StripeBillingDiscount {
  return {
    id: args.id,
    name: args.coupon.name ?? "Discount",
    amountOffCents: args.coupon.amount_off,
    percentOff: args.coupon.percent_off,
    duration: args.coupon.duration,
    end: iso(args.end),
    appliesToProductIds: args.coupon.applies_to?.products ?? [],
    scope: args.scope,
    subscriptionItemId: args.subscriptionItemId ?? null,
    appliedMrrCents: 0,
  };
}

async function currentDiscount(
  stripe: Stripe,
  discount: string | Stripe.Discount,
  scope: "subscription" | "item",
  subscriptionItemId: string | null,
): Promise<StripeBillingDiscount | null> {
  if (typeof discount === "string") return null;
  const coupon = await retrieveCoupon(stripe, discount.source.coupon);
  if (!coupon) return null;
  return discountFromCoupon({
    id: discount.id,
    coupon,
    scope,
    subscriptionItemId,
    end: discount.end,
  });
}

type FutureDiscountReference = {
  coupon: string | Stripe.Coupon | null;
  discount: string | Stripe.Discount | null;
  promotion_code: string | Stripe.PromotionCode | null;
};

async function futureDiscount(
  stripe: Stripe,
  reference: FutureDiscountReference,
  scope: "subscription" | "item",
  subscriptionItemId: string | null,
  index: number,
): Promise<StripeBillingDiscount | null> {
  const expandedDiscount =
    reference.discount && typeof reference.discount !== "string"
      ? reference.discount
      : null;
  const coupon = expandedDiscount
    ? await retrieveCoupon(stripe, expandedDiscount.source.coupon)
    : reference.coupon
      ? await retrieveCoupon(stripe, reference.coupon)
      : await retrievePromotionCoupon(stripe, reference.promotion_code);
  if (!coupon) return null;
  return discountFromCoupon({
    id: expandedDiscount?.id ?? `${coupon.id}:${scope}:${index}`,
    coupon,
    scope,
    subscriptionItemId,
    end: expandedDiscount?.end,
  });
}

async function itemFromPrice(args: {
  stripe: Stripe;
  subscriptionId: string;
  subscriptionItemId: string;
  price: string | Stripe.Price | Stripe.DeletedPrice;
  quantity: number | null | undefined;
  periodStart?: number | null;
  periodEnd?: number | null;
  discounts?: Array<string | Stripe.Discount>;
  futureDiscounts?: FutureDiscountReference[];
}): Promise<StripeBillingItem | null> {
  const price =
    typeof args.price === "string"
      ? await args.stripe.prices.retrieve(args.price, { expand: ["product"] })
      : args.price;
  if (!priceIsRecurring(price) || price.unit_amount == null) return null;

  const details = productDetails(price);
  const itemDiscounts = (
    await Promise.all([
      ...(args.discounts ?? []).map((discount) =>
        currentDiscount(
          args.stripe,
          discount,
          "item",
          args.subscriptionItemId,
        ),
      ),
      ...(args.futureDiscounts ?? []).map((discount, index) =>
        futureDiscount(
          args.stripe,
          discount,
          "item",
          args.subscriptionItemId,
          index,
        ),
      ),
    ])
  ).filter((discount): discount is StripeBillingDiscount => Boolean(discount));

  return {
    subscriptionId: args.subscriptionId,
    subscriptionItemId: args.subscriptionItemId,
    priceId: price.id,
    ...details,
    quantity: args.quantity ?? 1,
    unitAmountCents: price.unit_amount,
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count,
    currentPeriodStart: iso(args.periodStart),
    currentPeriodEnd: iso(args.periodEnd),
    itemDiscounts,
  };
}

async function stateFromSchedulePhase(
  stripe: Stripe,
  subscriptionId: string,
  phase: Stripe.SubscriptionSchedule.Phase,
): Promise<StripeScheduledBillingState> {
  const items = (
    await Promise.all(
      phase.items.map((item, index) =>
        itemFromPrice({
          stripe,
          subscriptionId,
          subscriptionItemId: `scheduled:${subscriptionId}:${index}`,
          price: item.price,
          quantity: item.quantity,
          periodStart: phase.start_date,
          periodEnd: phase.end_date,
          futureDiscounts: item.discounts,
        }),
      ),
    )
  ).filter((item): item is StripeBillingItem => Boolean(item));
  const discounts = (
    await Promise.all(
      phase.discounts.map((discount, index) =>
        futureDiscount(stripe, discount, "subscription", null, index),
      ),
    )
  ).filter((discount): discount is StripeBillingDiscount => Boolean(discount));

  return {
    ...calculateStripeBillingState({ items, subscriptionDiscounts: discounts }),
    effectiveAt: new Date(phase.start_date * 1000).toISOString(),
  };
}

async function scheduledFromSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  current: StripeBillingState,
): Promise<StripeScheduledBillingState | null> {
  const now = Date.now() / 1000;
  if (subscription.schedule) {
    const scheduleId =
      typeof subscription.schedule === "string"
        ? subscription.schedule
        : subscription.schedule.id;
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, {
      expand: [
        "phases.items.price.product",
        "phases.items.discounts.coupon",
        "phases.items.discounts.discount",
        "phases.items.discounts.promotion_code",
        "phases.discounts.coupon",
        "phases.discounts.discount",
        "phases.discounts.promotion_code",
      ],
    });
    const futurePhases = schedule.phases
      .filter((phase) => phase.start_date > now)
      .sort((a, b) => a.start_date - b.start_date);
    for (const phase of futurePhases) {
      const future = await stateFromSchedulePhase(stripe, subscription.id, phase);
      if (
        future.baseMrrCents !== current.baseMrrCents ||
        future.discountMrrCents !== current.discountMrrCents ||
        future.effectiveMrrCents !== current.effectiveMrrCents
      ) return future;
    }
  }

  const pending = subscription.pending_update;
  if (!pending?.subscription_items?.length) return null;
  const effectiveAt = pending.billing_cycle_anchor ?? pending.expires_at;
  const items = (
    await Promise.all(
      pending.subscription_items.map((item) =>
        itemFromPrice({
          stripe,
          subscriptionId: subscription.id,
          subscriptionItemId: item.id,
          price: item.price,
          quantity: item.quantity,
          periodStart: effectiveAt,
          periodEnd: item.current_period_end,
          discounts: item.discounts,
        }),
      ),
    )
  ).filter((item): item is StripeBillingItem => Boolean(item));
  const discounts = (
    await Promise.all(
      (pending.discounts ?? []).map((discount) =>
        currentDiscount(stripe, discount, "subscription", null),
      ),
    )
  ).filter((discount): discount is StripeBillingDiscount => Boolean(discount));
  const future = {
    ...calculateStripeBillingState({ items, subscriptionDiscounts: discounts }),
    effectiveAt: new Date(effectiveAt * 1000).toISOString(),
  };
  return (
    future.baseMrrCents !== current.baseMrrCents ||
    future.discountMrrCents !== current.discountMrrCents ||
    future.effectiveMrrCents !== current.effectiveMrrCents
      ? future
      : null
  );
}

async function loadSubscriptionBilling(
  stripe: Stripe,
  subscriptionId: string,
): Promise<SubscriptionBillingState> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: [
      "items.data.price.product",
      "items.data.discounts",
      "discounts",
      "discounts.source.coupon",
      "schedule",
      "pending_update.discounts",
      "pending_update.subscription_items.price.product",
      "pending_update.subscription_items.discounts",
    ],
  });

  const items = (
    await Promise.all(
      subscription.items.data.map((item) =>
        itemFromPrice({
          stripe,
          subscriptionId,
          subscriptionItemId: item.id,
          price: item.price,
          quantity: item.quantity,
          periodStart: item.current_period_start,
          periodEnd: item.current_period_end,
          discounts: item.discounts,
        }),
      ),
    )
  ).filter((item): item is StripeBillingItem => Boolean(item));
  const discounts = (
    await Promise.all(
      subscription.discounts.map((discount) =>
        currentDiscount(stripe, discount, "subscription", null),
      ),
    )
  ).filter((discount): discount is StripeBillingDiscount => Boolean(discount));

  const current = calculateStripeBillingState({ items, subscriptionDiscounts: discounts });
  return {
    subscriptionId,
    current,
    scheduled: await scheduledFromSubscription(stripe, subscription, current),
  };
}

function combineStates(states: StripeBillingState[]): StripeBillingState {
  return {
    items: states.flatMap((state) => state.items),
    baseMrrCents: states.reduce((sum, state) => sum + state.baseMrrCents, 0),
    discountMrrCents: states.reduce((sum, state) => sum + state.discountMrrCents, 0),
    effectiveMrrCents: states.reduce((sum, state) => sum + state.effectiveMrrCents, 0),
    discounts: states.flatMap((state) => state.discounts),
  };
}

export function combineSubscriptionBillingStates(
  subscriptions: SubscriptionBillingState[],
): StripeBillingSnapshot {
  const current = combineStates(subscriptions.map((subscription) => subscription.current));
  const nextEffectiveAt = subscriptions
    .flatMap((subscription) => subscription.scheduled?.effectiveAt ?? [])
    .sort()[0] ?? null;
  const scheduledStates = nextEffectiveAt
    ? subscriptions.map((subscription) =>
        subscription.scheduled?.effectiveAt === nextEffectiveAt
          ? subscription.scheduled
          : subscription.current,
      )
    : [];
  const scheduledCombined = scheduledStates.length
    ? combineStates(scheduledStates)
    : null;

  return {
    source: "stripe",
    subscriptionIds: subscriptions.map((subscription) => subscription.subscriptionId),
    subscriptions,
    current,
    scheduled:
      scheduledCombined &&
      (scheduledCombined.baseMrrCents !== current.baseMrrCents ||
        scheduledCombined.discountMrrCents !== current.discountMrrCents ||
        scheduledCombined.effectiveMrrCents !== current.effectiveMrrCents)
        ? { ...scheduledCombined, effectiveAt: nextEffectiveAt! }
        : null,
  };
}

async function loadUncached(
  subscriptionIds: string[],
): Promise<StripeBillingSnapshot | null> {
  const stripe = getStripe();
  if (subscriptionIds.length === 0) return null;
  if (!stripe) {
    console.error("[admin-mrr] Stripe billing snapshot fallback", {
      subscriptionCount: subscriptionIds.length,
      reason: "stripe_unavailable",
    });
    return null;
  }
  try {
    const states = await Promise.all(
      subscriptionIds.map((subscriptionId) =>
        loadSubscriptionBilling(stripe, subscriptionId),
      ),
    );
    return combineSubscriptionBillingStates(states);
  } catch (error) {
    const stripeError = error as { code?: unknown; type?: unknown };
    console.error("[admin-mrr] Stripe billing snapshot fallback", {
      subscriptionCount: subscriptionIds.length,
      reason:
        typeof stripeError.code === "string"
          ? stripeError.code
          : typeof stripeError.type === "string"
            ? stripeError.type
            : error instanceof Error
              ? error.name
              : "unknown_error",
    });
    return null;
  }
}

/** Read-only, per-process 60-second cache. Failures safely return null for fallback. */
export function loadStripeBillingSnapshot(
  subscriptionIds: string[],
): Promise<StripeBillingSnapshot | null> {
  const normalized = [...new Set(subscriptionIds)].sort();
  const key = normalized.join(":");
  const now = Date.now();
  const cached = snapshotCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = loadUncached(normalized);
  snapshotCache.set(key, { expiresAt: now + CACHE_TTL_MS, value });
  return value;
}

export function clearStripeBillingSnapshotCacheForTests(): void {
  snapshotCache.clear();
}
