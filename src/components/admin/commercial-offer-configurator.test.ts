import { describe, expect, it } from "vitest";
import { buildCommercialOfferConfigFromState } from "@/components/admin/commercial-offer-configurator";

describe("buildCommercialOfferConfigFromState", () => {
  it("preserves independent pricing for catalog and custom platform rows", () => {
    const config = buildCommercialOfferConfigFromState({
      selectedPlan: {
        id: "plan-1",
        plan_key: "launch",
        name: "Launch",
        description: null,
        default_price_cents: 5000,
        billing_interval: "month",
        is_active: true,
        sort_order: 0,
      },
      monthlyPriceDollars: "50",
      selectedProductKeys: ["client_portal", "online_booking", "other"],
      platformPricingByKey: {
        client_portal: { pricingMode: "included", amountDollars: "99" },
        online_booking: { pricingMode: "monthly", amountDollars: "15" },
      },
      customPlatformRows: [
        {
          id: "custom-1",
          name: "Payments Integration",
          pricingMode: "monthly",
          amountDollars: "25",
        },
        {
          id: "custom-2",
          name: "Custom Setup",
          pricingMode: "one_time",
          amountDollars: "150",
        },
      ],
      serviceAddOnSelections: [],
      customServiceAddOnRows: [],
      planInclusions: [],
      setupInclusions: [],
      setupFeeDollars: "0",
      monthlyDiscountDollars: "0",
      monthlyDiscountDurationMonths: "0",
      serviceAddOns: [],
    });

    expect(config.platformComponentPricing).toEqual([
      {
        productKey: "client_portal",
        pricingMode: "included",
        amountDollars: 0,
      },
      {
        productKey: "online_booking",
        pricingMode: "monthly",
        amountDollars: 15,
      },
    ]);
    expect(config.customPlatformComponents).toEqual([
      {
        name: "Payments Integration",
        pricingMode: "monthly",
        amountDollars: 25,
      },
      {
        name: "Custom Setup",
        pricingMode: "one_time",
        amountDollars: 150,
      },
    ]);
  });

  it("preserves annual cadence for catalog, platform, and custom services", () => {
    const config = buildCommercialOfferConfigFromState({
      selectedPlan: {
        id: "plan-1",
        plan_key: "launch",
        name: "Launch",
        description: null,
        default_price_cents: 5000,
        billing_interval: "month",
        is_active: true,
        sort_order: 0,
      },
      monthlyPriceDollars: "50",
      selectedProductKeys: ["domain"],
      platformPricingByKey: {
        domain: { pricingMode: "annual", amountDollars: "25" },
      },
      customPlatformRows: [],
      serviceAddOnSelections: [
        {
          productKey: "inventory",
          monthlyPriceDollars: "60",
          pricingMode: "annual",
        },
      ],
      customServiceAddOnRows: [
        {
          id: "custom-annual",
          name: "Registration renewal",
          description: "",
          monthlyPriceDollars: "40",
          pricingMode: "annual",
        },
      ],
      planInclusions: [],
      setupInclusions: [],
      setupFeeDollars: "0",
      monthlyDiscountDollars: "0",
      monthlyDiscountDurationMonths: "0",
      serviceAddOns: [
        {
          id: "inventory",
          product_key: "inventory",
          name: "Inventory",
          description: null,
          category: "add_on",
          category_group: null,
          default_add_on_price_cents: 6000,
          suggested_add_on_price_cents: 6000,
          supports_quantity: false,
          sort_order: 0,
          is_active: true,
        },
      ],
    });

    expect(config.platformComponentPricing[0]?.pricingMode).toBe("annual");
    expect(config.serviceAddOns[0]?.pricingMode).toBe("annual");
    expect(config.customServiceAddOns[0]?.pricingMode).toBe("annual");
  });
});
