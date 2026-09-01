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
      platformComponentPricing: [
        {
          productKey: "website",
          pricingMode: "included",
          amountDollars: 0,
        },
        {
          productKey: "hosting",
          pricingMode: "included",
          amountDollars: 0,
        },
      ],
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

  it("round-trips independent catalog and custom platform prices", () => {
    const pricedItems = asItems(
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
          {
            product_key: "online_booking",
            name: "Online Booking",
            pricing_mode: "monthly",
            unit_amount_cents: 1500,
          },
        ],
        planInclusions: [],
        setupInclusions: [],
        extras: {
          custom_platform_components: [
            {
              name: "Payments Integration",
              pricing_mode: "one_time",
              unit_amount_cents: 2500,
            },
            {
              name: "Reporting Integration",
              pricing_mode: "monthly",
              unit_amount_cents: 900,
            },
          ],
        },
      }),
    );

    const config = parseCommercialConfigFromOffer(
      { plan_inclusions: [], setup_inclusions: [] },
      pricedItems,
    );

    expect(config?.platformComponentPricing).toEqual([
      {
        productKey: "online_booking",
        pricingMode: "monthly",
        amountDollars: 15,
      },
    ]);
    expect(config?.customPlatformComponents).toEqual([
      {
        name: "Payments Integration",
        pricingMode: "one_time",
        amountDollars: 25,
      },
      {
        name: "Reporting Integration",
        pricingMode: "monthly",
        amountDollars: 9,
      },
    ]);
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

  it("hydrates legacy bundled platform rows as Included", () => {
    const legacy = items.map((item) =>
      item.metadata?.product_key === "website"
        ? {
            ...item,
            metadata: {
              product_key: "website",
              commercial_role: "bundled_product",
              included_in_plan: true,
            },
          }
        : item,
    );

    const config = parseCommercialConfigFromOffer(
      { plan_inclusions: [], setup_inclusions: [] },
      legacy,
    );

    expect(
      config?.platformComponentPricing.find(
        (row) => row.productKey === "website",
      ),
    ).toEqual({
      productKey: "website",
      pricingMode: "included",
      amountDollars: 0,
    });
  });
});
