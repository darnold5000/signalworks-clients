import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { DISCOUNT_SCOPE, discountScopeFromMetadata } from "@/lib/offers/discount-scope";
import { isPaidAddOnItem } from "@/lib/offers/offer-item-metadata";

export type OfferPricingSummary = {
  planName: string;
  currency: string;
  /** Base subscription plan only (monthly). */
  baseMonthlyAmountCents: number;
  /** Paid recurring add-ons (monthly). */
  recurringAddOnAmountCents: number;
  /** Recurring discount line amount (positive cents). */
  recurringDiscountAmountCents: number;
  /** Monthly total during an active recurring discount. */
  discountedMonthlyAmountCents: number;
  /** Monthly total after recurring discount ends (base + add-ons). */
  standardMonthlyAmountAfterDiscountCents: number;
  discountDurationMonths: number | null;
  /** When discount applies for the life of the subscription. */
  discountIsPermanent: boolean;
  oneTimeAmountCents: number;
  dueAtCheckoutCents: number;
};

function lineAmount(item: ClientOfferItem): number {
  return item.quantity * item.unit_amount_cents;
}

export function buildOfferPricingSummary(
  items: ClientOfferItem[],
  currency = "usd",
): OfferPricingSummary {
  const totals = calculateOfferTotals(items);
  const selected = items.filter((item) => item.is_selected);

  const basePlan = selected.find((item) => item.item_type === "base_plan");
  const baseMonthlyAmountCents = basePlan ? lineAmount(basePlan) : 0;
  const planName = basePlan?.name ?? "Subscription plan";

  const recurringAddOnAmountCents = selected
    .filter((item) => isPaidAddOnItem(item))
    .reduce((sum, item) => sum + lineAmount(item), 0);

  const discountItem = selected.find(
    (item) =>
      (item.item_type === "discount" || item.item_type === "credit") &&
      discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING,
  );

  const recurringDiscountAmountCents = discountItem
    ? lineAmount(discountItem)
    : 0;

  const standardMonthlyAmountAfterDiscountCents =
    baseMonthlyAmountCents + recurringAddOnAmountCents;

  const discountDurationMonths =
    discountItem?.discount_duration_type === "repeating" &&
    discountItem.discount_duration_months
      ? discountItem.discount_duration_months
      : null;

  const discountIsPermanent =
    Boolean(discountItem) &&
    (discountItem?.discount_duration_type === "forever" ||
      (!discountItem?.discount_duration_type && !discountDurationMonths));

  return {
    planName,
    currency,
    baseMonthlyAmountCents,
    recurringAddOnAmountCents,
    recurringDiscountAmountCents,
    discountedMonthlyAmountCents: totals.recurring_total_cents,
    standardMonthlyAmountAfterDiscountCents,
    discountDurationMonths,
    discountIsPermanent,
    oneTimeAmountCents: totals.initial_total_cents,
    dueAtCheckoutCents: calculateAmountDueFirstCycle(totals),
  };
}
