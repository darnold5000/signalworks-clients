import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { recurringCadence } from "@/lib/offers/billing-cadence";
import { DISCOUNT_SCOPE, discountScopeFromMetadata } from "@/lib/offers/discount-scope";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";
import type { StripeBillingSnapshot } from "@/lib/admin/stripe-billing-snapshot";

export type ScheduledRecurringFinancials = {
  effectiveAt: string;
  baseRecurringMrrCents: number;
  activeRecurringDiscountMrrCents: number;
  effectiveMrrCents: number;
  activeDiscountCount: number;
  annualRecurringCents: number;
  arrCents: number;
};

export type RecurringFinancials = {
  baseRecurringMrrCents: number;
  activeRecurringDiscountMrrCents: number;
  effectiveMrrCents: number;
  recurringCostsCents: number;
  effectiveMarginCents: number;
  discountKind: "none" | "ongoing" | "temporary" | "temporary_unknown" | "mixed";
  discountPeriodsRemaining: number | null;
  discountEndsAt: string | null;
  activeDiscountCount: number;
  annualRecurringCents: number;
  arrCents: number;
  source: "stripe" | "purchase_snapshot_fallback";
  scheduled: ScheduledRecurringFinancials | null;
};

export type RecurringFinancialSource = {
  items: ClientOfferItem[];
  finiteDiscountState?: Record<string, { active: boolean; endsAt: string | null }>;
};

export type PurchaseFinancialRecord = {
  status: string;
  purchased_at: string | null;
  purchase_snapshot: {
    offer?: { billing_method?: string | null };
    items?: ClientOfferItem[];
  } | null;
};

export function recurringSourcesFromPurchases(records: PurchaseFinancialRecord[]): RecurringFinancialSource[] {
  return records.flatMap((purchase) => {
    const snapshot = purchase.purchase_snapshot;
    if (
      (purchase.status !== "active" && purchase.status !== "paid") ||
      snapshot?.offer?.billing_method === "proposal_only" ||
      !snapshot?.items?.length ||
      !purchase.purchased_at
    ) return [];
    return [{ items: snapshot.items }];
  });
}

function normalizeToMrr(cents: number, item: ClientOfferItem): number {
  const { interval, intervalCount } = recurringCadence(item);
  if (interval === "year") return 0;
  return Math.round(cents / intervalCount);
}

function discountState(item: ClientOfferItem, source: RecurringFinancialSource) {
  if (item.discount_duration_type === "once") return { active: false, ongoing: false, remaining: 0 };
  if (item.discount_duration_type === "repeating" && item.discount_duration_months) {
    const authoritative = source.finiteDiscountState?.[item.id];
    return authoritative
      ? { active: authoritative.active, ongoing: false, remaining: null, endsAt: authoritative.endsAt, known: true }
      : { active: false, ongoing: false, remaining: null, endsAt: null, known: false };
  }
  return { active: true, ongoing: true, remaining: null, endsAt: null, known: true };
}

function inlineDiscountCents(item: ClientOfferItem): number {
  const gross = item.unit_amount_cents * item.quantity;
  if (item.discount_type === "amount" && item.discount_amount_cents) return Math.min(gross, item.discount_amount_cents);
  if (item.discount_type === "percent" && item.discount_percent) return Math.round(gross * Number(item.discount_percent) / 100);
  return 0;
}

export function calculateRecurringFinancials(
  sources: RecurringFinancialSource[],
  recurringCostsCents = 0,
): RecurringFinancials {
  let base = 0;
  let discount = 0;
  let sawOngoing = false;
  let sawTemporary = false;
  let sawUnknownTemporary = false;
  let activeDiscountCount = 0;
  let annualRecurringCents = 0;
  const remainingPeriods: number[] = [];
  const discountEndDates: string[] = [];

  for (const source of sources) {
    const selected = source.items.filter((item) => item.is_selected).sort((a, b) => a.sort_order - b.sort_order);
    for (const item of selected) {
      if (item.item_type === "discount" || item.item_type === "credit") {
        if (discountScopeFromMetadata(item) !== DISCOUNT_SCOPE.RECURRING) continue;
        const state = discountState(item, source);
        sawUnknownTemporary ||= state.known === false;
        if (!state.active) continue;
        // Recurring discount lines created by the offer builder are explicitly
        // monthly. Legacy lines default to monthly for compatibility.
        discount += item.unit_amount_cents * item.quantity;
        activeDiscountCount += 1;
        sawOngoing ||= state.ongoing;
        sawTemporary ||= !state.ongoing;
        if (state.remaining != null) remainingPeriods.push(state.remaining);
        if (state.endsAt) discountEndDates.push(state.endsAt);
        continue;
      }
      if (item.billing_type !== "recurring" || isEntitlementOfferItem(item)) continue;
      if (recurringCadence(item).interval === "year") {
        annualRecurringCents += item.unit_amount_cents * item.quantity;
        continue;
      }
      base += normalizeToMrr(item.unit_amount_cents * item.quantity, item);
      const inline = inlineDiscountCents(item);
      if (inline > 0) {
        const state = discountState(item, source);
        sawUnknownTemporary ||= state.known === false;
        if (state.active) {
          discount += normalizeToMrr(inline, item);
          activeDiscountCount += 1;
          sawOngoing ||= state.ongoing;
          sawTemporary ||= !state.ongoing;
          if (state.remaining != null) remainingPeriods.push(state.remaining);
          if (state.endsAt) discountEndDates.push(state.endsAt);
        }
      }
    }
  }

  const effective = Math.max(0, base - discount);
  return {
    baseRecurringMrrCents: base,
    activeRecurringDiscountMrrCents: discount,
    effectiveMrrCents: effective,
    recurringCostsCents,
    effectiveMarginCents: effective - recurringCostsCents,
    discountKind: sawUnknownTemporary
      ? (sawOngoing || sawTemporary ? "mixed" : "temporary_unknown")
      : sawOngoing && sawTemporary ? "mixed" : sawOngoing ? "ongoing" : sawTemporary ? "temporary" : "none",
    discountPeriodsRemaining: remainingPeriods.length ? Math.min(...remainingPeriods) : null,
    discountEndsAt: discountEndDates.sort()[0] ?? null,
    activeDiscountCount,
    annualRecurringCents,
    arrCents: effective * 12 + annualRecurringCents,
    source: "purchase_snapshot_fallback",
    scheduled: null,
  };
}

function stripeDiscountKind(snapshot: StripeBillingSnapshot): RecurringFinancials["discountKind"] {
  const discounts = snapshot.current.discounts;
  const ongoing = discounts.some((discount) => discount.duration === "forever");
  const temporary = discounts.some((discount) => discount.duration !== "forever");
  return ongoing && temporary ? "mixed" : ongoing ? "ongoing" : temporary ? "temporary" : "none";
}

export function recurringFinancialsFromStripeSnapshot(
  snapshot: StripeBillingSnapshot,
  recurringCostsCents = 0,
): RecurringFinancials {
  const ends = snapshot.current.discounts
    .flatMap((discount) => discount.end ?? [])
    .sort();
  return {
    baseRecurringMrrCents: snapshot.current.baseMrrCents,
    activeRecurringDiscountMrrCents: snapshot.current.discountMrrCents,
    effectiveMrrCents: snapshot.current.effectiveMrrCents,
    recurringCostsCents,
    effectiveMarginCents: snapshot.current.effectiveMrrCents - recurringCostsCents,
    discountKind: stripeDiscountKind(snapshot),
    discountPeriodsRemaining: null,
    discountEndsAt: ends[0] ?? null,
    activeDiscountCount: snapshot.current.discounts.length,
    annualRecurringCents: snapshot.current.annualRecurringCents,
    arrCents: snapshot.current.arrCents,
    source: "stripe",
    scheduled: snapshot.scheduled
      ? {
          effectiveAt: snapshot.scheduled.effectiveAt,
          baseRecurringMrrCents: snapshot.scheduled.baseMrrCents,
          activeRecurringDiscountMrrCents: snapshot.scheduled.discountMrrCents,
          effectiveMrrCents: snapshot.scheduled.effectiveMrrCents,
          activeDiscountCount: snapshot.scheduled.discounts.length,
          annualRecurringCents: snapshot.scheduled.annualRecurringCents,
          arrCents: snapshot.scheduled.arrCents,
        }
      : null,
  };
}

export function legacyRecurringFinancials(monthlyPriceCents: number, recurringCostsCents = 0): RecurringFinancials {
  return {
    baseRecurringMrrCents: monthlyPriceCents,
    activeRecurringDiscountMrrCents: 0,
    effectiveMrrCents: monthlyPriceCents,
    recurringCostsCents,
    effectiveMarginCents: monthlyPriceCents - recurringCostsCents,
    discountKind: "none",
    discountPeriodsRemaining: null,
    discountEndsAt: null,
    activeDiscountCount: 0,
    annualRecurringCents: 0,
    arrCents: monthlyPriceCents * 12,
    source: "purchase_snapshot_fallback",
    scheduled: null,
  };
}
