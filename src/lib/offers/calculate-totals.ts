import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  DISCOUNT_SCOPE,
  discountScopeFromMetadata,
} from "@/lib/offers/discount-scope";
import { isEntitlementOfferItem } from "@/lib/offers/offer-item-metadata";

export type OfferTotals = {
  /** Sum of billable line amounts before offer-level discount/credit lines. */
  subtotal_cents: number;
  /** Total value of discount/credit line items (positive cents). */
  discount_total_cents: number;
  /**
   * One-time charges due upfront (setup fees, etc.).
   * Recurring-only offers store 0 — not the first subscription cycle.
   */
  initial_total_cents: number;
  /** Recurring amount per billing cycle (MRR when monthly). */
  recurring_total_cents: number;
};

function lineAmount(item: ClientOfferItem): number {
  return item.quantity * item.unit_amount_cents;
}

function discountFromFields(
  amountCents: number,
  item: ClientOfferItem,
): number {
  if (item.discount_type === "amount" && item.discount_amount_cents) {
    return Math.min(amountCents, item.discount_amount_cents);
  }
  if (item.discount_type === "percent" && item.discount_percent) {
    return Math.round((amountCents * Number(item.discount_percent)) / 100);
  }
  return 0;
}

export function calculateOfferTotals(
  items: ClientOfferItem[],
): OfferTotals {
  const selected = items.filter((item) => item.is_selected);

  let subtotal_cents = 0;
  let discount_total_cents = 0;
  let initial_total_cents = 0;
  let recurring_total_cents = 0;

  for (const item of selected) {
    const line = lineAmount(item);

    if (item.item_type === "discount" || item.item_type === "credit") {
      if (discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING) {
        recurring_total_cents = Math.max(0, recurring_total_cents - line);
      } else {
        discount_total_cents += line;
      }
      continue;
    }

    if (isEntitlementOfferItem(item)) {
      continue;
    }

    subtotal_cents += line;

    const netLine = line - discountFromFields(line, item);

    if (item.billing_type === "one_time") {
      initial_total_cents += netLine;
      continue;
    }

    recurring_total_cents += netLine;
  }

  return {
    subtotal_cents: Math.max(0, subtotal_cents),
    discount_total_cents: Math.max(0, discount_total_cents),
    initial_total_cents: Math.max(0, initial_total_cents),
    recurring_total_cents: Math.max(0, recurring_total_cents),
  };
}

/**
 * Amount due when the client first pays (first billing cycle):
 * upfront one-time charges plus the first recurring cycle, minus offer discounts.
 */
export function calculateAmountDueFirstCycle(totals: OfferTotals): number {
  return Math.max(
    0,
    totals.initial_total_cents +
      totals.recurring_total_cents -
      totals.discount_total_cents,
  );
}
