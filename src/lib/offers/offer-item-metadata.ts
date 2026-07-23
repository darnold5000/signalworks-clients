import { CATALOG_VERSION } from "@/lib/catalog/types";
import type { ClientOfferItem } from "@/lib/database/phase1-types";

export const COMMERCIAL_ROLE = {
  BUNDLED_PRODUCT: "bundled_product",
  PAID_ADD_ON: "paid_add_on",
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

export function customBundledProductMetadata(name: string) {
  return {
    product_key: "custom",
    catalog_version: CATALOG_VERSION,
    commercial_role: COMMERCIAL_ROLE.BUNDLED_PRODUCT,
    included_in_plan: true,
    custom_name: name,
  };
}

export function customPaidAddOnMetadata(name: string) {
  return {
    product_key: "custom",
    commercial_role: COMMERCIAL_ROLE.PAID_ADD_ON,
    included_in_plan: false,
    custom_name: name,
  };
}

export function isBundledProductItem(item: ClientOfferItem): boolean {
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
  return isBundledProductItem(item);
}
