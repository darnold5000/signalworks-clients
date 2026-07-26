import type { ClientOfferItem } from "@/lib/database/phase1-types";

const PLACEHOLDER_NAME =
  /^(item\s*\d+|other\s*\d+|untitled|new item|component\s*\d+|add[- ]?on\s*\d+)$/i;

export function isPlaceholderOfferItemName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_NAME.test(trimmed);
}

export function validateOfferItemsForCustomerFacing(
  items: ClientOfferItem[],
): string | null {
  for (const item of items) {
    if (!item.is_selected) continue;
    if (item.item_type === "discount" || item.item_type === "credit") continue;

    if (isPlaceholderOfferItemName(item.name)) {
      return `Line item "${item.name}" needs a clear customer-facing name before publishing.`;
    }
  }
  return null;
}
