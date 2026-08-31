import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import {
  COMMERCIAL_ROLE,
  isIncludedSetupItem,
  isPaidAddOnItem,
  isPlanInclusionItem,
} from "@/lib/offers/offer-item-metadata";
import {
  hasManagedCommercialPricing,
  isManagedCommercialOfferItem,
} from "@/lib/offers/managed-commercial-items";

export function parseCommercialConfigFromOffer(
  offer: Pick<ClientOffer, "plan_inclusions" | "setup_inclusions">,
  items: ClientOfferItem[],
): CommercialOfferConfig | null {
  if (!hasManagedCommercialPricing(items)) {
    return null;
  }

  const basePlan = items.find(
    (item) =>
      item.item_type === "base_plan" &&
      typeof item.metadata?.plan_key === "string",
  );
  const planKey = String(basePlan?.metadata?.plan_key ?? "launch");
  const monthlyPriceDollars = basePlan
    ? basePlan.unit_amount_cents / 100
    : 0;

  const productKeys = items
    .filter(
      (item) =>
        item.item_type === "product" &&
        item.metadata?.commercial_role === COMMERCIAL_ROLE.BUNDLED_PRODUCT &&
        item.metadata?.product_key !== "custom",
    )
    .map((item) => String(item.metadata?.product_key));

  const customPlatformComponents = items
    .filter(
      (item) =>
        item.item_type === "product" &&
        item.metadata?.commercial_role === COMMERCIAL_ROLE.BUNDLED_PRODUCT &&
        item.metadata?.product_key === "custom",
    )
    .map((item) => ({
      name: String(item.metadata?.custom_name ?? item.name),
    }));

  const planInclusions =
    offer.plan_inclusions && offer.plan_inclusions.length > 0
      ? [...offer.plan_inclusions]
      : items.filter(isPlanInclusionItem).map((item) => item.name);

  const setupInclusions =
    offer.setup_inclusions && offer.setup_inclusions.length > 0
      ? [...offer.setup_inclusions]
      : items.filter(isIncludedSetupItem).map((item) => item.name);

  const serviceAddOns = items
    .filter(
      (item) =>
        isPaidAddOnItem(item) && item.metadata?.product_key !== "custom",
    )
    .map((item) => ({
      productKey: String(item.metadata?.product_key),
      monthlyPriceDollars: item.unit_amount_cents / 100,
      quantity: item.quantity,
      billingType: item.billing_type,
    }));

  const customServiceAddOns = items
    .filter(
      (item) =>
        isPaidAddOnItem(item) && item.metadata?.product_key === "custom",
    )
    .map((item) => ({
      name: String(item.metadata?.custom_name ?? item.name),
      description: item.description ?? "",
      monthlyPriceDollars: item.unit_amount_cents / 100,
      quantity: item.quantity,
      billingType: item.billing_type,
    }));

  const setupFeeItem = items.find(
    (item) => item.item_type === "setup_fee" && isManagedCommercialOfferItem(item),
  );
  const setupFeeDollars = setupFeeItem
    ? setupFeeItem.unit_amount_cents / 100
    : 0;

  const discountItem = items.find(
    (item) => item.item_type === "discount" && isManagedCommercialOfferItem(item),
  );
  const monthlyDiscountDollars = discountItem
    ? discountItem.unit_amount_cents / 100
    : 0;
  const monthlyDiscountDurationMonths =
    discountItem?.discount_duration_type === "repeating"
      ? (discountItem.discount_duration_months ?? 0)
      : 0;

  return {
    planKey: planKey as CommercialOfferConfig["planKey"],
    monthlyPriceDollars,
    productKeys,
    serviceAddOns,
    customPlatformComponents,
    customServiceAddOns,
    setupFeeDollars,
    monthlyDiscountDollars,
    monthlyDiscountDurationMonths,
    planInclusions,
    setupInclusions,
  };
}
