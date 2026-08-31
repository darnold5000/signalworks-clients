import { describe, expect, it } from "vitest";
import {
  buildDraftOfferItemsForSummary,
  buildInviteOfferItemRows,
  calculateInviteOfferTotals,
} from "@/lib/catalog/build-invite-offer";
import { commercialOfferConfigSchema } from "@/lib/catalog/commercial-config-validation";
import { parseCommercialConfigFromOffer } from "@/lib/offers/parse-commercial-config-from-offer";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";

describe("commercial config roundtrip", () => {
  const config = commercialOfferConfigSchema.parse({
    planKey: "launch",
    monthlyPriceDollars: 50,
    productKeys: ["website", "hosting"],
    serviceAddOns: [
      {
        productKey: "seo",
        monthlyPriceDollars: 15,
        quantity: 1,
        billingType: "recurring",
      },
    ],
    customPlatformComponents: [],
    customServiceAddOns: [],
    setupFeeDollars: 25,
    monthlyDiscountDollars: 10,
    monthlyDiscountDurationMonths: 3,
    planInclusions: ["Website"],
    setupInclusions: ["Hosting"],
  });

  it("calculates live totals from the same rows used for persistence", () => {
    const totals = calculateInviteOfferTotals({
      plan: {
        plan_key: config.planKey,
        name: "Launch",
        monthly_price_cents: 5000,
        billing_interval: "month",
      },
      products: [
        { product_key: "website", name: "Website" },
        { product_key: "hosting", name: "Hosting" },
      ],
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
    });

    expect(totals.recurring_total_cents).toBe(5500);
    expect(totals.initial_total_cents).toBe(2500);
    expect(calculateAmountDueFirstCycle(totals)).toBe(8000);
  });

  it("hydrates saved commercial config from generated rows", () => {
    const rows = buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan: {
        plan_key: config.planKey,
        name: "Launch",
        monthly_price_cents: 5000,
        billing_interval: "month",
      },
      products: [
        { product_key: "website", name: "Website" },
        { product_key: "hosting", name: "Hosting" },
      ],
      planInclusions: [
        { product_key: "plan_inclusion_website", name: "Website" },
      ],
      setupInclusions: [
        { product_key: "setup_inclusion_hosting", name: "Hosting" },
      ],
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
    }).map((row, index) => ({
      ...row,
      id: `item-${index}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const hydrated = parseCommercialConfigFromOffer(
      {
        plan_inclusions: config.planInclusions,
        setup_inclusions: config.setupInclusions,
      },
      rows,
    );

    expect(hydrated?.planKey).toBe("launch");
    expect(hydrated?.monthlyPriceDollars).toBe(50);
    expect(hydrated?.productKeys).toEqual(["website", "hosting"]);
    expect(hydrated?.setupFeeDollars).toBe(25);
    expect(hydrated?.monthlyDiscountDollars).toBe(10);
    expect(hydrated?.monthlyDiscountDurationMonths).toBe(3);

    const previewTotals = calculateInviteOfferTotals({
      plan: {
        plan_key: hydrated!.planKey,
        name: "Launch",
        monthly_price_cents: hydrated!.monthlyPriceDollars * 100,
        billing_interval: "month",
      },
      products: hydrated!.productKeys.map((key) => ({
        product_key: key,
        name: key,
      })),
      extras: {
        setup_fee_cents: hydrated!.setupFeeDollars * 100,
        monthly_discount_cents: hydrated!.monthlyDiscountDollars * 100,
        monthly_discount_duration_months: hydrated!.monthlyDiscountDurationMonths,
        paid_add_ons: hydrated!.serviceAddOns.map((addOn) => ({
          product_key: addOn.productKey,
          name: addOn.productKey,
          unit_amount_cents: addOn.monthlyPriceDollars * 100,
          quantity: addOn.quantity ?? 1,
          billing_type: addOn.billingType ?? "recurring",
        })),
      },
    });

    const persistedTotals = calculateInviteOfferTotals({
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
    });

    expect(previewTotals).toEqual(persistedTotals);
    expect(
      buildDraftOfferItemsForSummary({
        plan: {
          plan_key: hydrated!.planKey,
          name: "Launch",
          monthly_price_cents: hydrated!.monthlyPriceDollars * 100,
          billing_interval: "month",
        },
        products: [],
      }).length,
    ).toBeGreaterThan(0);
  });
});
