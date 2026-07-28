import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  INCLUDED_SETUP_ITEMS,
  LEGACY_MANAGED_EMAIL_PRODUCT_KEY,
  PLAN_STANDARD_INCLUSIONS,
} from "@/lib/catalog/plan-inclusions";
import { catalogProductDisplayName, offerItemProductKey } from "@/lib/catalog/display-names";
import {
  isBundledProductItem,
  isIncludedSetupItem,
  isPaidAddOnItem,
  isPlanInclusionItem,
} from "@/lib/offers/offer-item-metadata";

const PLAN_INCLUSION_KEYS = new Set(
  PLAN_STANDARD_INCLUSIONS.map((row) => row.product_key),
);
const INCLUDED_SETUP_KEYS = new Set(
  INCLUDED_SETUP_ITEMS.map((row) => row.product_key),
);

export type InvoiceLine = {
  id: string;
  name: string;
  productKey: string | null;
  amountCents: number;
  quantity: number;
  included: boolean;
};

function lineName(item: ClientOfferItem): string {
  const key = offerItemProductKey(item.metadata);
  return catalogProductDisplayName(key, item.name);
}

function isLegacyIncludedSetupAsPaid(item: ClientOfferItem): boolean {
  const key = offerItemProductKey(item.metadata);
  return (
    key === LEGACY_MANAGED_EMAIL_PRODUCT_KEY &&
    isPaidAddOnItem(item) &&
    item.unit_amount_cents === 0
  );
}

function isLegacyBundledAsPlanInclusion(item: ClientOfferItem): boolean {
  if (!isBundledProductItem(item)) return false;
  const key = offerItemProductKey(item.metadata);
  if (!key || key.startsWith("inclusion_")) return false;
  if (key === "website") return true;
  return false;
}

export function resolvePlanInclusionLines(
  items: ClientOfferItem[],
): InvoiceLine[] {
  const selected = items.filter((item) => item.is_selected);
  const explicit = selected.filter(
    (item) => isPlanInclusionItem(item) || PLAN_INCLUSION_KEYS.has(offerItemProductKey(item.metadata) ?? ""),
  );

  if (explicit.length > 0) {
    return explicit.map((item) => ({
      id: item.id,
      name: lineName(item),
      productKey: offerItemProductKey(item.metadata),
      amountCents: 0,
      quantity: item.quantity,
      included: true,
    }));
  }

  const legacyWebsite = selected.filter(isLegacyBundledAsPlanInclusion);
  if (legacyWebsite.length > 0) {
    return PLAN_STANDARD_INCLUSIONS.map((row, index) => ({
      id: `legacy-plan-inclusion-${index}`,
      name: row.name,
      productKey: row.product_key,
      amountCents: 0,
      quantity: 1,
      included: true,
    }));
  }

  const legacyBundled = selected.filter(
    (item) => isBundledProductItem(item) && !isIncludedSetupItem(item),
  );
  if (legacyBundled.length > 0) {
    return legacyBundled.map((item) => ({
      id: item.id,
      name: lineName(item),
      productKey: offerItemProductKey(item.metadata),
      amountCents: 0,
      quantity: item.quantity,
      included: true,
    }));
  }

  return [];
}

export function resolveIncludedSetupLines(
  items: ClientOfferItem[],
): InvoiceLine[] {
  const selected = items.filter((item) => item.is_selected);
  const explicit = selected.filter(
    (item) =>
      isIncludedSetupItem(item) ||
      INCLUDED_SETUP_KEYS.has(offerItemProductKey(item.metadata) ?? ""),
  );

  if (explicit.length > 0) {
    return explicit.map((item) => ({
      id: item.id,
      name: lineName(item),
      productKey: offerItemProductKey(item.metadata),
      amountCents: 0,
      quantity: item.quantity,
      included: true,
    }));
  }

  return [];
}

export function resolvePaidRecurringAddOnLines(
  items: ClientOfferItem[],
): InvoiceLine[] {
  return items
    .filter(
      (item) =>
        item.is_selected &&
        isPaidAddOnItem(item) &&
        item.billing_type === "recurring" &&
        !isLegacyIncludedSetupAsPaid(item),
    )
    .map((item) => ({
      id: item.id,
      name: lineName(item),
      productKey: offerItemProductKey(item.metadata),
      amountCents: item.unit_amount_cents * item.quantity,
      quantity: item.quantity,
      included: false,
    }));
}

export function resolveOneTimeServiceLines(
  items: ClientOfferItem[],
): InvoiceLine[] {
  return items
    .filter(
      (item) =>
        item.is_selected &&
        item.billing_type === "one_time" &&
        item.item_type !== "discount" &&
        item.item_type !== "credit" &&
        item.item_type !== "setup_fee" &&
        (isPaidAddOnItem(item) || item.item_type === "add_on"),
    )
    .map((item) => ({
      id: item.id,
      name: item.description?.trim() || lineName(item),
      productKey: offerItemProductKey(item.metadata),
      amountCents: item.unit_amount_cents * item.quantity,
      quantity: item.quantity,
      included: false,
    }));
}
