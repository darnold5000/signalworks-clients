import type { PlatformProductCatalogItem } from "@/lib/catalog/types";

/** Display order and labels for platform component groups. */
export const PLATFORM_COMPONENT_SECTIONS: Array<{
  key: string;
  label: string;
}> = [
  { key: "core_digital_presence", label: "Core Digital Presence" },
  { key: "business_platform", label: "Business Platform" },
  { key: "operations", label: "Operations" },
  { key: "payments", label: "Payments" },
  { key: "marketing", label: "Marketing" },
  { key: "ai", label: "AI" },
  { key: "commerce", label: "Commerce" },
  { key: "integrations", label: "Integrations" },
  { key: "custom", label: "Custom" },
];

/** Display order and labels for service add-on groups. */
export const SERVICE_ADD_ON_SECTIONS: Array<{
  key: string;
  label: string;
}> = [
  { key: "marketing", label: "Marketing" },
  { key: "communication", label: "Communication" },
  { key: "ai", label: "AI" },
  { key: "operations", label: "Operations" },
  { key: "commerce", label: "Commerce" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "custom", label: "Custom" },
];

export function groupCatalogBySection(
  items: PlatformProductCatalogItem[],
  sections: Array<{ key: string; label: string }>,
): Array<{
  key: string;
  label: string;
  items: PlatformProductCatalogItem[];
}> {
  const byKey = new Map<string, PlatformProductCatalogItem[]>();
  for (const item of items) {
    const group = item.category_group ?? item.category ?? "other";
    const list = byKey.get(group) ?? [];
    list.push(item);
    byKey.set(group, list);
  }

  return sections
    .map((section) => ({
      ...section,
      items: byKey.get(section.key) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

export function defaultAddOnPriceDollars(
  item: PlatformProductCatalogItem,
): string {
  const cents =
    item.default_add_on_price_cents ??
    item.suggested_add_on_price_cents ??
    0;
  return String(cents / 100);
}
