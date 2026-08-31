import {
  buildInviteOfferItemRows,
  dollarsToCents,
} from "@/lib/catalog/build-invite-offer";
import type { CommercialOfferConfig } from "@/lib/catalog/commercial-config-validation";
import { addOnDefaultBillingType } from "@/lib/catalog/plan-inclusions";
import {
  getPaidAddOnsByKeys,
  getPlanTemplateByKey,
  getProductsByKeys,
} from "@/lib/catalog/queries";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import { isManagedCommercialOfferItem } from "@/lib/offers/managed-commercial-items";
import { getOfferWithItemsWithServiceClient } from "@/lib/offers/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function inclusionProducts(prefix: string, names: string[]) {
  return names.map((name, index) => ({
    product_key: `${prefix}_${slugify(name) || index + 1}`,
    name,
  }));
}

export class OfferNotEditableError extends Error {
  constructor(message = "Only draft proposals can be edited.") {
    super(message);
    this.name = "OfferNotEditableError";
  }
}

export async function assertDraftOfferEditable(
  tenantId: string,
  offerId: string,
) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from(TABLES.clientOffers)
    .select("status, tenant_id")
    .eq("id", offerId)
    .maybeSingle();

  if (!existing || existing.tenant_id !== tenantId) {
    throw new Error("Offer not found.");
  }
  if (existing.status !== "draft") {
    throw new OfferNotEditableError();
  }
}

export async function applyCommercialConfigToOffer(args: {
  tenantId: string;
  offerId: string;
  config: CommercialOfferConfig;
}) {
  await assertDraftOfferEditable(args.tenantId, args.offerId);

  const planTemplate = await getPlanTemplateByKey(args.config.planKey);
  if (!planTemplate) {
    throw new Error("Selected plan is not available.");
  }

  const componentKeys = args.config.productKeys.filter((key) => key !== "other");
  const products =
    componentKeys.length > 0 ? await getProductsByKeys(componentKeys) : [];
  if (products.length !== componentKeys.length) {
    throw new Error("One or more selected platform components are invalid.");
  }

  const serviceAddOnKeys = args.config.serviceAddOns.map(
    (addOn) => addOn.productKey,
  );
  const serviceAddOnCatalog = await getPaidAddOnsByKeys(serviceAddOnKeys);
  if (serviceAddOnCatalog.length !== serviceAddOnKeys.length) {
    throw new Error("One or more selected service add-ons are invalid.");
  }

  const monthlyPriceCents = dollarsToCents(args.config.monthlyPriceDollars);
  const setupFeeCents = dollarsToCents(args.config.setupFeeDollars);
  const monthlyDiscountCents = dollarsToCents(
    args.config.monthlyDiscountDollars,
  );
  const monthlyDiscountDurationMonths =
    args.config.monthlyDiscountDurationMonths;

  const paidAddOns = args.config.serviceAddOns.map((selection) => {
    const catalogItem = serviceAddOnCatalog.find(
      (product) => product.product_key === selection.productKey,
    );
    if (!catalogItem) {
      throw new Error("One or more selected service add-ons are invalid.");
    }
    return {
      product_key: catalogItem.product_key,
      name: catalogItem.name,
      unit_amount_cents: dollarsToCents(selection.monthlyPriceDollars),
      quantity: selection.quantity ?? 1,
      billing_type:
        selection.billingType ??
        addOnDefaultBillingType(catalogItem.product_key),
    };
  });

  const customPlatformComponents = args.config.customPlatformComponents
    .map((row) => ({ name: row.name.trim() }))
    .filter((row) => row.name.length > 0);

  const customServiceAddOns = args.config.customServiceAddOns
    .map((row) => ({
      name: row.name.trim(),
      description: row.description?.trim() || undefined,
      unit_amount_cents: dollarsToCents(row.monthlyPriceDollars),
      quantity: row.quantity ?? 1,
      billing_type: row.billingType ?? "recurring",
    }))
    .filter((row) => row.name.length > 0);

  const supabase = createServiceClient();
  const offer = await getOfferWithItemsWithServiceClient(args.offerId, supabase);
  if (!offer || offer.tenant_id !== args.tenantId) {
    throw new Error("Offer not found.");
  }

  const managedItemIds = offer.items
    .filter(isManagedCommercialOfferItem)
    .map((item) => item.id);

  if (managedItemIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(TABLES.clientOfferItems)
      .delete()
      .in("id", managedItemIds);
    if (deleteError) {
      throw new Error("Could not replace managed commercial line items.");
    }
  }

  const manualItems = offer.items.filter(
    (item) => !isManagedCommercialOfferItem(item),
  );
  const nextSortOrder =
    manualItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;

  const itemRows = buildInviteOfferItemRows({
    tenantId: args.tenantId,
    offerId: args.offerId,
    plan: {
      plan_key: planTemplate.plan_key,
      name: planTemplate.name,
      monthly_price_cents: monthlyPriceCents,
      billing_interval: planTemplate.billing_interval as
        | "month"
        | "day"
        | "week"
        | "year",
    },
    products: products.map((product) => ({
      product_key: product.product_key,
      name: product.name,
    })),
    planInclusions: inclusionProducts(
      "plan_inclusion",
      args.config.planInclusions,
    ),
    setupInclusions: inclusionProducts(
      "setup_inclusion",
      args.config.setupInclusions,
    ),
    extras: {
      setup_fee_cents: setupFeeCents > 0 ? setupFeeCents : undefined,
      monthly_discount_cents:
        monthlyDiscountCents > 0 ? monthlyDiscountCents : undefined,
      monthly_discount_duration_months:
        monthlyDiscountCents > 0 && monthlyDiscountDurationMonths > 0
          ? monthlyDiscountDurationMonths
          : undefined,
      paid_add_ons: paidAddOns.length > 0 ? paidAddOns : undefined,
      custom_platform_components:
        customPlatformComponents.length > 0
          ? customPlatformComponents
          : undefined,
      custom_service_add_ons:
        customServiceAddOns.length > 0 ? customServiceAddOns : undefined,
    },
  }).map((row, index) => ({
    ...row,
    sort_order: nextSortOrder + index,
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from(TABLES.clientOfferItems)
    .insert(itemRows)
    .select("*");

  if (insertError || !insertedItems) {
    throw new Error("Could not save commercial line items.");
  }

  const allItems = [
    ...manualItems,
    ...(insertedItems as ClientOfferItem[]),
  ];
  const totals = calculateOfferTotals(allItems);

  const { error: offerUpdateError } = await supabase
    .from(TABLES.clientOffers)
    .update({
      ...totals,
      plan_inclusions: args.config.planInclusions,
      setup_inclusions: args.config.setupInclusions,
    })
    .eq("id", args.offerId)
    .eq("status", "draft");

  if (offerUpdateError) {
    throw new Error("Could not update proposal totals.");
  }

  return getOfferWithItemsWithServiceClient(args.offerId, supabase);
}
