import { CATALOG_VERSION } from "@/lib/catalog/types";
import type { ClientOfferItem } from "@/lib/database/phase1-types";

export const COMMERCIAL_ROLE = {
  BUNDLED_PRODUCT: "bundled_product",
  PAID_ADD_ON: "paid_add_on",
  PLAN_INCLUSION: "plan_inclusion",
  INCLUDED_SETUP: "included_setup",
  PLATFORM_COMPONENT: "platform_component",
} as const;

export type CommercialRole =
  (typeof COMMERCIAL_ROLE)[keyof typeof COMMERCIAL_ROLE];

export type BundledProductMetadata = {
  product_key: string;
  catalog_version: number;
  commercial_role: typeof COMMERCIAL_ROLE.BUNDLED_PRODUCT;
  included_in_plan: true;
};

export type PaidAddOnMetadata = {
  product_key: string;
  catalog_version?: number;
  commercial_role: typeof COMMERCIAL_ROLE.PAID_ADD_ON;
  included_in_plan: false;
};

export function bundledProductMetadata(
  productKey: string,
): BundledProductMetadata {
  return {
    product_key: productKey,
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.BUNDLED_PRODUCT,
    included_in_plan: true,
  };
}

export function paidAddOnMetadata(productKey: string): PaidAddOnMetadata {
  return {
    product_key: productKey,
    commercial_role: COMMERCIAL_ROLE.PAID_ADD_ON,
    included_in_plan: false,
  };
}

export function planInclusionMetadata(productKey: string) {
  return {
    product_key: productKey,
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.PLAN_INCLUSION,
    included_in_plan: true,
  };
}

export function includedSetupMetadata(productKey: string) {
  return {
    product_key: productKey,
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.INCLUDED_SETUP,
    included_in_plan: true,
  };
}

export function customBundledProductMetadata(name: string) {
  return {
    product_key: "custom",
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.BUNDLED_PRODUCT,
    included_in_plan: true,
    custom_name: name,
  };
}

export type PlatformPricingMode = "included" | "one_time" | "monthly";

export function platformComponentMetadata(
  productKey: string,
  pricingMode: PlatformPricingMode,
  amountCents: number,
  customName?: string,
) {
  return {
    product_key: productKey,
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.PLATFORM_COMPONENT,
    included_in_plan: pricingMode === "included",
    pricing_mode: pricingMode,
    configured_amount_cents: pricingMode === "included" ? 0 : amountCents,
    ...(customName ? { custom_name: customName } : {}),
  };
}

/** New platform rows plus legacy bundled-product rows. */
export function isPlatformComponentItem(item: ClientOfferItem): boolean {
  const role = item.metadata?.commercial_role;
  return (
    (item.item_type === "product" || item.item_type === "add_on") &&
    (role === COMMERCIAL_ROLE.PLATFORM_COMPONENT ||
      role === COMMERCIAL_ROLE.BUNDLED_PRODUCT)
  );
}

export function platformPricingModeFromItem(
  item: ClientOfferItem,
): PlatformPricingMode {
  const stored = item.metadata?.pricing_mode;
  if (stored === "monthly" || stored === "one_time" || stored === "included") {
    return stored;
  }
  // All legacy bundled platform rows were included at $0.
  if (item.unit_amount_cents <= 0) return "included";
  return item.billing_type === "one_time" ? "one_time" : "monthly";
}

export function customPaidAddOnMetadata(name: string) {
  return {
    product_key: "custom",
    commercial_role: COMMERCIAL_ROLE.PAID_ADD_ON,
    included_in_plan: false,
    custom_name: name,
  };
}

export function isPlanInclusionItem(item: ClientOfferItem): boolean {
  return (
    item.item_type === "product" &&
    item.metadata?.commercial_role === COMMERCIAL_ROLE.PLAN_INCLUSION
  );
}

export function isIncludedSetupItem(item: ClientOfferItem): boolean {
  return (
    item.item_type === "product" &&
    item.metadata?.commercial_role === COMMERCIAL_ROLE.INCLUDED_SETUP
  );
}

export function isBundledProductItem(item: ClientOfferItem): boolean {
  if (isPlanInclusionItem(item) || isIncludedSetupItem(item)) {
    return false;
  }
  return (
    item.item_type === "product" ||
    (item.item_type === "add_on" &&
      item.metadata?.commercial_role === COMMERCIAL_ROLE.BUNDLED_PRODUCT)
  );
}

export function isPaidAddOnItem(item: ClientOfferItem): boolean {
  return (
    item.item_type === "add_on" &&
    item.metadata?.commercial_role === COMMERCIAL_ROLE.PAID_ADD_ON
  );
}

/** Entitlement lines included with the plan — excluded from billable totals and Stripe sync. */
export function isEntitlementOfferItem(item: ClientOfferItem): boolean {
  if (isPlatformComponentItem(item)) {
    return platformPricingModeFromItem(item) === "included";
  }
  return (
    isPlanInclusionItem(item) ||
    isIncludedSetupItem(item)
  );
}
