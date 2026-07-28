/** Canonical display names when catalog or offer rows lag behind migrations. */
const CATALOG_PRODUCT_DISPLAY_NAMES: Record<string, string> = {
  business_email_setup: "Business Email Setup",
  managed_email_delivery: "Managed Email Delivery",
  inclusion_basic_database: "Database",
};

export function catalogProductDisplayName(
  productKey: string | null | undefined,
  fallbackName: string,
): string {
  if (!productKey) return fallbackName;
  return CATALOG_PRODUCT_DISPLAY_NAMES[productKey] ?? fallbackName;
}

export function offerItemProductKey(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const key = metadata?.product_key;
  return typeof key === "string" ? key : null;
}
