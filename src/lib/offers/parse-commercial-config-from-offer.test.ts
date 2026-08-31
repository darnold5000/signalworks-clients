import { describe, expect, it } from "vitest";
import { buildInviteOfferItemRows } from "@/lib/catalog/build-invite-offer";
import type { ClientOfferItem } from "@/lib/database/phase1-types";
import { parseCommercialConfigFromOffer } from "@/lib/offers/parse-commercial-config-from-offer";

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

describe("parseCommercialConfigFromOffer", () => {
  const items = asItems(
    buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan: {
        plan_key: "launch",
        name: "Launch",
        monthly_price_cents: 5000,
        billing_interval: "month",
      },
      products: [
        { product_key: "website", name: "Website" },
        { product_key: "hosting", name: "Hosting" },
      ],
      planInclusions: [{ product_key: "plan_inclusion_website", name: "Website" }],
      setupInclusions: [{ product_key: "setup_inclusion_database", name: "Database" }],
      extras: {
        setup_fee_cents: 2500,
        monthly_discount_cents: 1000,
        monthly_discount_duration_months: 3,
        paid_add_ons: [
          {
            product_key: "seo",
            name: "SEO",
            unit_amount_cents: 1500,
            quantity: 2,
            billing_type: "recurring",
          },
        ],
        custom_service_add_ons: [
          {
            name: "Custom reporting",
            unit_amount_cents: 4000,
            billing_type: "one_time",
          },
        ],
      },
    }),
  );

  it("returns null when no managed commercial pricing exists", () => {
    expect(
      parseCommercialConfigFromOffer(
        { plan_inclusions: [], setup_inclusions: [] },
        [],
      ),
    ).toBeNull();
  });

  it("hydrates plan, components, fees, and discounts from stored items", () => {
    const config = parseCommercialConfigFromOffer(
      {
        plan_inclusions: ["Website"],
        setup_inclusions: ["Database"],
      },
      items,
    );

    expect(config).toEqual({
      planKey: "launch",
      monthlyPriceDollars: 50,
      productKeys: ["website", "hosting"],
      serviceAddOns: [
        {
          productKey: "seo",
          monthlyPriceDollars: 15,
          quantity: 2,
          billingType: "recurring",
        },
      ],
      customPlatformComponents: [],
      customServiceAddOns: [
        {
          name: "Custom reporting",
          description: "Custom service add-on",
          monthlyPriceDollars: 40,
          quantity: 1,
          billingType: "one_time",
        },
      ],
      setupFeeDollars: 25,
      monthlyDiscountDollars: 10,
      monthlyDiscountDurationMonths: 3,
      planInclusions: ["Website"],
      setupInclusions: ["Database"],
    });
  });

  it("prefers stored inclusion snapshots on the offer", () => {
    const config = parseCommercialConfigFromOffer(
      {
        plan_inclusions: ["Stored plan item"],
        setup_inclusions: ["Stored setup item"],
      },
      items,
    );

    expect(config?.planInclusions).toEqual(["Stored plan item"]);
    expect(config?.setupInclusions).toEqual(["Stored setup item"]);
  });
});
