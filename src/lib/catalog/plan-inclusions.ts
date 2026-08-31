import type { InviteProductSelection } from "@/lib/catalog/build-invite-offer";
import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

/** Standard plan entitlements — always on the offer invoice, never selectable. */
export const PLAN_STANDARD_INCLUSIONS: ReadonlyArray<{
  product_key: string;
  name: string;
}> = [
  { product_key: "inclusion_website", name: "Website" },
  { product_key: "inclusion_hosting", name: "Hosting" },
  { product_key: "inclusion_basic_database", name: "Database" },
  { product_key: "inclusion_website_security", name: "Website Security" },
  { product_key: "inclusion_platform_updates", name: "Platform Updates" },
  { product_key: "inclusion_basic_seo", name: "Basic SEO" },
  { product_key: "inclusion_maintenance_monitoring", name: "Maintenance & Monitoring" },
];

/** One-time setup included at no charge on every new commercial offer. */
export const INCLUDED_SETUP_ITEMS: ReadonlyArray<{
  product_key: string;
  name: string;
}> = [
  { product_key: "domain_transfer", name: "Domain Transfer" },
  { product_key: "business_email_setup", name: "Business Email Setup" },
];

export const DEFAULT_PLAN_INCLUSIONS = PLAN_STANDARD_INCLUSIONS.map(
  (row) => row.name,
);

export const DEFAULT_SETUP_INCLUSIONS = INCLUDED_SETUP_ITEMS.map(
  (row) => row.name,
);

/** Missing configuration is unknown, not evidence that standard inclusions were established. */
export function resolvePlanInclusions(value: string[] | null | undefined): string[] {
  return value ?? [];
}

/** Setup inclusions are displayed only when they were explicitly saved. */
export function resolveSetupInclusions(value: string[] | null | undefined): string[] {
  return value ?? [];
}

/** Legacy paid add-on key — still on old offers; new invites use managed_email_delivery. */
export const LEGACY_MANAGED_EMAIL_PRODUCT_KEY = "business_email_setup";
export const MANAGED_EMAIL_DELIVERY_PRODUCT_KEY = "managed_email_delivery";

const ONE_TIME_PAID_ADD_ON_KEYS = new Set([
  "data_migration",
  "custom_development",
  "api_integration",
]);

const SELECTOR_EXCLUDED_PRODUCT_KEYS = new Set([
  "other_add_on",
  LEGACY_MANAGED_EMAIL_PRODUCT_KEY,
  "domain_transfer",
  ...PLAN_STANDARD_INCLUSIONS.map((row) => row.product_key),
]);

export function planStandardInclusionProducts(): InviteProductSelection[] {
  return PLAN_STANDARD_INCLUSIONS.map((row) => ({
    product_key: row.product_key,
    name: row.name,
  }));
}

export function includedSetupProducts(): InviteProductSelection[] {
  return INCLUDED_SETUP_ITEMS.map((row) => ({
    product_key: row.product_key,
    name: row.name,
  }));
}

export function isPaidAddOnCatalogItem(item: PlatformProductCatalogItem): boolean {
  if (SELECTOR_EXCLUDED_PRODUCT_KEYS.has(item.product_key)) {
    return false;
  }
  return item.is_paid_add_on === true;
}

export function paidAddOnCatalogItems(
  catalog: PlatformProductCatalogItem[],
): PlatformProductCatalogItem[] {
  return catalog.filter(isPaidAddOnCatalogItem);
}

export function addOnDefaultBillingType(
  productKey: string,
): "recurring" | "one_time" {
  return ONE_TIME_PAID_ADD_ON_KEYS.has(productKey) ? "one_time" : "recurring";
}

export function formatPlanInclusionChipLine(): string {
  const names = PLAN_STANDARD_INCLUSIONS.map((row) => row.name);
  const mid = Math.ceil(names.length / 2);
  return `${names.slice(0, mid).join(" · ")}\n${names.slice(mid).join(" · ")}`;
}
