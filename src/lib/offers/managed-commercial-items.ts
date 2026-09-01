import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  COMMERCIAL_ROLE,
  isPaidAddOnItem,
} from "@/lib/offers/offer-item-metadata";
import {
  DISCOUNT_SCOPE,
  discountScopeFromMetadata,
} from "@/lib/offers/discount-scope";

/** Rows produced by buildInviteOfferItemRows / the commercial configurator. */
export function isManagedCommercialOfferItem(item: ClientOfferItem): boolean {
  if (item.item_type === "base_plan") {
    return typeof item.metadata?.plan_key === "string";
  }

  if (item.item_type === "product") {
    const role = item.metadata?.commercial_role;
    return (
      role === COMMERCIAL_ROLE.BUNDLED_PRODUCT ||
      role === COMMERCIAL_ROLE.PLATFORM_COMPONENT ||
      role === COMMERCIAL_ROLE.PLAN_INCLUSION ||
      role === COMMERCIAL_ROLE.INCLUDED_SETUP
    );
  }

  if (
    item.item_type === "add_on" &&
    item.metadata?.commercial_role === COMMERCIAL_ROLE.PLATFORM_COMPONENT
  ) {
    return true;
  }

  if (isPaidAddOnItem(item)) {
    return true;
  }

  if (item.item_type === "setup_fee") {
    return (
      item.name === "Setup fee" &&
      item.metadata?.catalog_version != null
    );
  }

  if (item.item_type === "discount") {
    return (
      item.name === "Monthly discount" &&
      discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING
    );
  }

  return false;
}

export function partitionOfferItems(items: ClientOfferItem[]) {
  const managed: ClientOfferItem[] = [];
  const manual: ClientOfferItem[] = [];
  for (const item of items) {
    if (isManagedCommercialOfferItem(item)) {
      managed.push(item);
    } else {
      manual.push(item);
    }
  }
  return { managed, manual };
}

export function hasManagedCommercialPricing(items: ClientOfferItem[]): boolean {
  return items.some(isManagedCommercialOfferItem);
}
