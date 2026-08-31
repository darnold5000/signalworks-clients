import { describe, expect, it } from "vitest";
import { buildInviteOfferItemRows } from "@/lib/catalog/build-invite-offer";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import {
  hasManagedCommercialPricing,
  isManagedCommercialOfferItem,
  partitionOfferItems,
} from "@/lib/offers/managed-commercial-items";
import { resolveOfferItemMetadata } from "@/lib/offers/build-offer-item-payload";

function asItems(
  rows: ReturnType<typeof buildInviteOfferItemRows>,
): ClientOfferItem[] {
  return rows.map((row, index) => ({
    ...row,
    id: `item-${index}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

describe("managed-commercial-items", () => {
  const managedRows = asItems(
    buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan: {
        plan_key: "launch",
        name: "Launch",
        monthly_price_cents: 5000,
        billing_interval: "month",
      },
      products: [{ product_key: "website", name: "Website" }],
      planInclusions: [{ product_key: "plan_inclusion_website", name: "Website" }],
      setupInclusions: [{ product_key: "setup_inclusion_hosting", name: "Hosting" }],
      extras: {
        setup_fee_cents: 2500,
        monthly_discount_cents: 1000,
        monthly_discount_duration_months: 3,
        paid_add_ons: [
          {
            product_key: "seo",
            name: "SEO",
            unit_amount_cents: 1500,
            quantity: 1,
            billing_type: "recurring",
          },
        ],
      },
    }),
  );

  const manualItem: ClientOfferItem = {
    id: "manual-1",
    offer_id: "offer-1",
    tenant_id: "tenant-1",
    item_type: "custom_service",
    name: "Custom consulting",
    description: null,
    quantity: 1,
    unit_amount_cents: 9000,
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
    sort_order: 99,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("identifies catalog-generated rows as managed", () => {
    expect(hasManagedCommercialPricing(managedRows)).toBe(true);
    for (const item of managedRows) {
      expect(isManagedCommercialOfferItem(item)).toBe(true);
    }
  });

  it("keeps manual custom services out of managed replacement", () => {
    expect(isManagedCommercialOfferItem(manualItem)).toBe(false);
    const { managed, manual } = partitionOfferItems([
      ...managedRows,
      manualItem,
    ]);
    expect(managed).toHaveLength(managedRows.length);
    expect(manual).toEqual([manualItem]);
  });

  it("treats manual add-ons without commercial metadata as manual", () => {
    const manualAddOn: ClientOfferItem = {
      ...manualItem,
      id: "manual-addon",
      item_type: "add_on",
      name: "Manual add-on",
      billing_type: "recurring",
      billing_interval: "month",
      metadata: resolveOfferItemMetadata({
        itemType: "add_on",
        name: "Manual add-on",
        quantity: 1,
        unitAmountCents: 1000,
        billingType: "recurring",
      }),
    };
    expect(isManagedCommercialOfferItem(manualAddOn)).toBe(false);
  });
});
