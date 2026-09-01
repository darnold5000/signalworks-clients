import { CATALOG_VERSION } from "@/lib/catalog/types";
import {
  includedSetupProducts,
  planStandardInclusionProducts,
} from "@/lib/catalog/plan-inclusions";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { recurringMonthlyDiscountMetadata } from "@/lib/offers/discount-scope";
import {
  customPaidAddOnMetadata,
  includedSetupMetadata,
  paidAddOnMetadata,
  planInclusionMetadata,
  platformComponentMetadata,
  type PlatformPricingMode,
} from "@/lib/offers/offer-item-metadata";

export type InvitePlanSelection = {
  plan_key: string;
  name: string;
  monthly_price_cents: number;
  billing_interval: "month" | "day" | "week" | "year";
};

export type InviteProductSelection = {
  product_key: string;
  name: string;
  pricing_mode?: PlatformPricingMode;
  unit_amount_cents?: number;
};

export type InvitePaidAddOnSelection = {
  product_key: string;
  name: string;
  unit_amount_cents: number;
  quantity?: number;
  billing_type?: "recurring" | "one_time";
};

export type InviteCustomServiceAddOn = {
  name: string;
  description?: string;
  unit_amount_cents: number;
  quantity?: number;
  billing_type?: "recurring" | "one_time";
};

export type InviteCustomPlatformComponent = {
  name: string;
  pricing_mode?: PlatformPricingMode;
  unit_amount_cents?: number;
};

export type InviteCommercialExtras = {
  setup_fee_cents?: number;
  monthly_discount_cents?: number;
  /** 0 or omitted = discount applies for the life of the subscription. */
  monthly_discount_duration_months?: number;
  paid_add_ons?: InvitePaidAddOnSelection[];
  custom_platform_components?: InviteCustomPlatformComponent[];
  custom_service_add_ons?: InviteCustomServiceAddOn[];
};

const PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000001";

function draftItem(
  partial: Partial<ClientOfferItem> &
    Pick<
      ClientOfferItem,
      | "item_type"
      | "name"
      | "unit_amount_cents"
      | "billing_type"
      | "quantity"
    >,
): ClientOfferItem {
  return {
    id: partial.id ?? PLACEHOLDER_UUID,
    offer_id: partial.offer_id ?? PLACEHOLDER_UUID,
    tenant_id: partial.tenant_id ?? PLACEHOLDER_UUID,
    item_type: partial.item_type,
    name: partial.name,
    description: partial.description ?? null,
    quantity: partial.quantity,
    unit_amount_cents: partial.unit_amount_cents,
    billing_type: partial.billing_type,
    billing_interval: partial.billing_interval ?? null,
    billing_interval_count: partial.billing_interval_count ?? 1,
    discount_type: null,
    discount_amount_cents: null,
    discount_percent: null,
    discount_duration_type: null,
    discount_duration_months: null,
    stripe_product_id: null,
    stripe_price_id: null,
    stripe_coupon_id: null,
    is_optional: false,
    is_selected: true,
    sort_order: partial.sort_order ?? 0,
    metadata: partial.metadata ?? {},
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

export function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

export function buildInviteOfferItemRows(args: {
  tenantId: string;
  offerId: string;
  plan: InvitePlanSelection;
  products: InviteProductSelection[];
  planInclusions?: InviteProductSelection[];
  setupInclusions?: InviteProductSelection[];
  extras?: InviteCommercialExtras;
}): Array<Omit<ClientOfferItem, "id" | "created_at" | "updated_at">> {
  const extras = args.extras ?? {};
  const rows: Array<Omit<ClientOfferItem, "id" | "created_at" | "updated_at">> =
    [
      {
        offer_id: args.offerId,
        tenant_id: args.tenantId,
        item_type: "base_plan",
        name: args.plan.name,
        description: null,
        quantity: 1,
        unit_amount_cents: args.plan.monthly_price_cents,
        billing_type: "recurring",
        billing_interval: args.plan.billing_interval,
        billing_interval_count: 1,
        discount_type: null,
        discount_amount_cents: null,
        discount_percent: null,
        discount_duration_type: null,
        discount_duration_months: null,
        stripe_product_id: null,
        stripe_price_id: null,
        stripe_coupon_id: null,
        is_optional: false,
        is_selected: true,
        sort_order: 0,
        metadata: {
          plan_key: args.plan.plan_key,
          catalog_version: CATALOG_VERSION,
        },
      },
    ];

  let sortOrder = 1;

  for (const product of args.planInclusions ?? planStandardInclusionProducts()) {
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "product",
      name: product.name,
      description: "Included with your plan",
      quantity: 1,
      unit_amount_cents: 0,
      billing_type: "recurring",
      billing_interval: "month",
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: planInclusionMetadata(product.product_key),
    });
  }

  for (const product of args.setupInclusions ?? includedSetupProducts()) {
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "product",
      name: product.name,
      description: "Included setup",
      quantity: 1,
      unit_amount_cents: 0,
      billing_type: "one_time",
      billing_interval: null,
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: includedSetupMetadata(product.product_key),
    });
  }

  for (const product of args.products) {
    const pricingMode = product.pricing_mode ?? "included";
    const included = pricingMode === "included";
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: included ? "product" : "add_on",
      name: product.name,
      description: included
        ? "Included platform capability"
        : "Additional platform capability",
      quantity: 1,
      unit_amount_cents: included ? 0 : (product.unit_amount_cents ?? 0),
      billing_type: pricingMode === "one_time" ? "one_time" : "recurring",
      billing_interval: pricingMode === "one_time" ? null : "month",
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: platformComponentMetadata(
        product.product_key,
        pricingMode,
        product.unit_amount_cents ?? 0,
      ),
    });
  }

  for (const custom of extras.custom_platform_components ?? []) {
    const trimmed = custom.name.trim();
    if (!trimmed) continue;
    const pricingMode = custom.pricing_mode ?? "included";
    const included = pricingMode === "included";
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: included ? "product" : "add_on",
      name: trimmed,
      description: included
        ? "Included custom platform capability"
        : "Additional custom platform capability",
      quantity: 1,
      unit_amount_cents: included ? 0 : (custom.unit_amount_cents ?? 0),
      billing_type: pricingMode === "one_time" ? "one_time" : "recurring",
      billing_interval: pricingMode === "one_time" ? null : "month",
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: platformComponentMetadata(
        "custom",
        pricingMode,
        custom.unit_amount_cents ?? 0,
        trimmed,
      ),
    });
  }

  for (const addOn of extras.paid_add_ons ?? []) {
    const quantity = Math.max(1, addOn.quantity ?? 1);
    const billingType = addOn.billing_type ?? "recurring";
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "add_on",
      name: addOn.name,
      description: "Service add-on",
      quantity,
      unit_amount_cents: addOn.unit_amount_cents,
      billing_type: billingType,
      billing_interval: billingType === "recurring" ? "month" : null,
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: paidAddOnMetadata(addOn.product_key),
    });
  }

  for (const custom of extras.custom_service_add_ons ?? []) {
    const trimmed = custom.name.trim();
    if (!trimmed) continue;
    const quantity = Math.max(1, custom.quantity ?? 1);
    const billingType = custom.billing_type ?? "recurring";
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "add_on",
      name: trimmed,
      description: custom.description?.trim() || "Custom service add-on",
      quantity,
      unit_amount_cents: custom.unit_amount_cents,
      billing_type: billingType,
      billing_interval: billingType === "recurring" ? "month" : null,
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: customPaidAddOnMetadata(trimmed),
    });
  }

  if (extras.setup_fee_cents && extras.setup_fee_cents > 0) {
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "setup_fee",
      name: "Setup fee",
      description: "One-time onboarding charge",
      quantity: 1,
      unit_amount_cents: extras.setup_fee_cents,
      billing_type: "one_time",
      billing_interval: null,
      billing_interval_count: 1,
      discount_type: null,
      discount_amount_cents: null,
      discount_percent: null,
      discount_duration_type: null,
      discount_duration_months: null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: { catalog_version: CATALOG_VERSION },
    });
  }

  if (extras.monthly_discount_cents && extras.monthly_discount_cents > 0) {
    const durationMonths = extras.monthly_discount_duration_months ?? 0;
    rows.push({
      offer_id: args.offerId,
      tenant_id: args.tenantId,
      item_type: "discount",
      name: "Monthly discount",
      description:
        durationMonths > 0
          ? `Recurring discount for ${durationMonths} month${durationMonths === 1 ? "" : "s"}, then full price`
          : "Recurring discount on this agreement",
      quantity: 1,
      unit_amount_cents: extras.monthly_discount_cents,
      billing_type: "one_time",
      billing_interval: null,
      billing_interval_count: 1,
      discount_type: "amount",
      discount_amount_cents: extras.monthly_discount_cents,
      discount_percent: null,
      discount_duration_type:
        durationMonths > 0 ? "repeating" : "forever",
      discount_duration_months: durationMonths > 0 ? durationMonths : null,
      stripe_product_id: null,
      stripe_price_id: null,
      stripe_coupon_id: null,
      is_optional: false,
      is_selected: true,
      sort_order: sortOrder++,
      metadata: recurringMonthlyDiscountMetadata(),
    });
  }

  return rows;
}

export function buildDraftOfferItemsForSummary(args: {
  plan: InvitePlanSelection;
  products: InviteProductSelection[];
  extras?: InviteCommercialExtras;
}): ClientOfferItem[] {
  const rows = buildInviteOfferItemRows({
    tenantId: PLACEHOLDER_UUID,
    offerId: PLACEHOLDER_UUID,
    plan: args.plan,
    products: args.products,
    extras: args.extras,
  });

  return rows.map((row) => draftItem(row));
}

export function calculateInviteOfferTotals(args: {
  plan: InvitePlanSelection;
  products: InviteProductSelection[];
  extras?: InviteCommercialExtras;
}) {
  return calculateOfferTotals(buildDraftOfferItemsForSummary(args));
}

export { calculateAmountDueFirstCycle };

export function validateCustomPlanPrice(
  planKey: string,
  monthlyPriceCents: number,
): string | null {
  if (planKey !== "custom") return null;
  if (monthlyPriceCents <= 0) {
    return "Custom plan requires a monthly amount greater than zero.";
  }
  return null;
}
