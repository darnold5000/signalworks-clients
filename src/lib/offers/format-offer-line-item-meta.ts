import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  DISCOUNT_SCOPE,
  discountScopeFromMetadata,
} from "@/lib/offers/discount-scope";
import { cadenceDescription } from "@/lib/offers/billing-cadence";

const ITEM_TYPE_LABELS: Record<ClientOfferItem["item_type"], string> = {
  base_plan: "Base plan",
  setup_fee: "Setup fee",
  add_on: "Add-on",
  product: "Included",
  custom_service: "Custom service",
  discount: "Discount",
  credit: "Credit",
};

function monthsLabel(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function formatOfferLineItemSubtitle(item: ClientOfferItem): string {
  if (item.item_type === "discount" || item.item_type === "credit") {
    const scope = discountScopeFromMetadata(item);
    if (scope === DISCOUNT_SCOPE.RECURRING) {
      if (
        item.discount_duration_type === "forever" ||
        (!item.discount_duration_type && !item.discount_duration_months)
      ) {
        return "Recurring · ongoing";
      }
      if (
        item.discount_duration_type === "repeating" &&
        item.discount_duration_months
      ) {
        return `Recurring · ${monthsLabel(item.discount_duration_months)}`;
      }
      if (item.discount_duration_type === "repeating") {
        return "Recurring · limited term";
      }
      return "Recurring discount";
    }
    return "First billing cycle only";
  }

  const typeLabel =
    ITEM_TYPE_LABELS[item.item_type] ??
    item.item_type.replaceAll("_", " ");

  if (item.billing_type === "recurring") {
    return `${typeLabel} · ${cadenceDescription(item).replace("Billed ", "").toLowerCase()}`;
  }

  return `${typeLabel} · one-time`;
}
