import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { PLATFORM_COMPONENT_SECTIONS } from "@/lib/catalog/catalog-sections";
import { isBundledProductItem } from "@/lib/offers/offer-item-metadata";

const PRODUCT_KEY_TO_SECTION: Record<string, string> = {
  website: "core_digital_presence",
  client_portal: "business_platform",
  database: "business_platform",
  online_booking: "operations",
  stripe_payments: "payments",
  ecommerce: "commerce",
  integrations: "integrations",
  other: "custom",
};

const SECTION_CUSTOMER_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORM_COMPONENT_SECTIONS.map((section) => [
    section.key,
    section.label,
  ]),
);

export type IncludedPlatformGroup = {
  sectionKey: string;
  sectionLabel: string;
  itemNames: string[];
};

export function groupIncludedPlatformItems(
  items: ClientOfferItem[],
): IncludedPlatformGroup[] {
  const bundled = items.filter(
    (item) => item.is_selected && isBundledProductItem(item),
  );

  const bySection = new Map<string, string[]>();

  for (const item of bundled) {
    const productKey =
      typeof item.metadata?.product_key === "string"
        ? item.metadata.product_key
        : "other";
    const sectionKey =
      PRODUCT_KEY_TO_SECTION[productKey] ??
      (productKey === "custom" ? "custom" : "business_platform");
    const list = bySection.get(sectionKey) ?? [];
    list.push(item.name.trim());
    bySection.set(sectionKey, list);
  }

  return PLATFORM_COMPONENT_SECTIONS.filter((section) =>
    bySection.has(section.key),
  ).map((section) => ({
    sectionKey: section.key,
    sectionLabel: SECTION_CUSTOMER_LABEL[section.key] ?? section.label,
    itemNames: bySection.get(section.key) ?? [],
  }));
}

export function includedPlatformSummarySentence(
  groups: IncludedPlatformGroup[],
): string {
  const names = groups.flatMap((group) => group.itemNames);
  if (names.length === 0) {
    return "Standard platform services included with your selected plan.";
  }
  if (names.length <= 6) {
    return names.join(", ");
  }
  const head = names.slice(0, 5).join(", ");
  return `${head}, and ${names.length - 5} more`;
}
