import type { ClientOfferItem } from "@/lib/database/phase1-types";

export type OfferTotals = {
  subtotal_cents: number;
  discount_total_cents: number;
  initial_total_cents: number;
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
      discount_total_cents += line;
      continue;
    }

    subtotal_cents += line;

    if (item.billing_type === "one_time") {
      initial_total_cents += line - discountFromFields(line, item);
      continue;
    }

    const recurringLine = line - discountFromFields(line, item);
    recurring_total_cents += recurringLine;
    initial_total_cents += recurringLine;
  }

  initial_total_cents = Math.max(0, initial_total_cents - discount_total_cents);
  subtotal_cents = Math.max(0, subtotal_cents);
  discount_total_cents = Math.max(0, discount_total_cents);

  return {
    subtotal_cents,
    discount_total_cents,
    initial_total_cents,
    recurring_total_cents,
  };
}
