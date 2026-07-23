import { CATALOG_VERSION } from "@/lib/catalog/types";
import type { ClientOfferItemType } from "@/lib/database/phase1-types";
import {
  DISCOUNT_SCOPE,
  firstCycleDiscountMetadata,
  recurringMonthlyDiscountMetadata,
  type DiscountScope,
} from "@/lib/offers/discount-scope";
import {
  bundledProductMetadata,
  paidAddOnMetadata,
} from "@/lib/offers/offer-item-metadata";

export type OfferItemFormInput = {
  itemType: ClientOfferItemType;
  name: string;
  description?: string;
  quantity: number;
  unitAmountCents: number;
  billingType: "one_time" | "recurring";
  billingInterval?: "day" | "week" | "month" | "year";
  billingIntervalCount?: number;
  discountType?: "amount" | "percent";
  discountAmountCents?: number;
  discountPercent?: number;
  discountDurationType?: "once" | "repeating" | "forever";
  discountDurationMonths?: number;
  isOptional?: boolean;
  isSelected?: boolean;
  sortOrder?: number;
  productKey?: string;
  discountScope?: DiscountScope;
  metadata?: Record<string, unknown>;
};

export function defaultBillingForItemType(
  itemType: ClientOfferItemType,
): "one_time" | "recurring" {
  if (itemType === "setup_fee" || itemType === "discount" || itemType === "credit") {
    return "one_time";
  }
  return "recurring";
}

export function resolveOfferItemMetadata(
  item: OfferItemFormInput,
): Record<string, unknown> {
  if (item.metadata && Object.keys(item.metadata).length > 0) {
    return item.metadata;
  }

  if (item.itemType === "product" && item.productKey) {
    return bundledProductMetadata(item.productKey);
  }

  if (item.itemType === "add_on" && item.productKey) {
    return paidAddOnMetadata(item.productKey);
  }

  if (item.itemType === "discount" || item.itemType === "credit") {
    return item.discountScope === DISCOUNT_SCOPE.RECURRING
      ? recurringMonthlyDiscountMetadata()
      : firstCycleDiscountMetadata();
  }

  if (item.itemType === "base_plan") {
    return { catalog_version: CATALOG_VERSION };
  }

  return {};
}
