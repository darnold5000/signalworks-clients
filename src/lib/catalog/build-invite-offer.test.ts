import { describe, expect, it } from "vitest";
import {
  buildDraftOfferItemsForSummary,
  buildInviteOfferItemRows,
  calculateInviteOfferTotals,
  dollarsToCents,
  validateCustomPlanPrice,
} from "@/lib/catalog/build-invite-offer";
import { inviteClientRequestSchema } from "@/lib/catalog/invite-validation";
import { calculateAmountDueFirstCycle, calculateOfferTotals } from "@/lib/offers/calculate-totals";

describe("build-invite-offer", () => {
  const plan = {
    plan_key: "launch",
    name: "Launch",
    monthly_price_cents: 19900,
    billing_interval: "month" as const,
  };

  it("converts dollars to cents", () => {
    expect(dollarsToCents(149)).toBe(14900);
    expect(dollarsToCents(149.99)).toBe(14999);
  });

  it("stores plan price override on the base-plan offer item", () => {
    const rows = buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan,
      products: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].item_type).toBe("base_plan");
    expect(rows[0].unit_amount_cents).toBe(19900);
    expect(rows[0].metadata).toEqual({
      plan_key: "launch",
      catalog_version: 2,
    });
  });

  it("creates separate offer items for selected products", () => {
    const rows = buildInviteOfferItemRows({
      tenantId: "tenant-1",
      offerId: "offer-1",
      plan,
      products: [
        { product_key: "website", name: "Website" },
        { product_key: "online_booking", name: "Online Booking" },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows[1].item_type).toBe("product");
    expect(rows[1].metadata).toEqual({
      product_key: "website",
      catalog_version: 2,
      commercial_role: "bundled_product",
      included_in_plan: true,
    });
    expect(rows[2].metadata).toEqual({
      product_key: "online_booking",
      catalog_version: 2,
      commercial_role: "bundled_product",
      included_in_plan: true,
    });
  });

  it("keeps zero-dollar bundled products from increasing MRR", () => {
    const totals = calculateInviteOfferTotals({
      plan,
      products: [{ product_key: "website", name: "Website" }],
    });

    expect(totals.recurring_total_cents).toBe(19900);
    expect(totals.initial_total_cents).toBe(0);
  });

  it("adds paid add-ons, setup fees, and recurring discounts", () => {
    const totals = calculateInviteOfferTotals({
      plan,
      products: [],
      extras: {
        paid_add_ons: [
          {
            product_key: "sms_notifications",
            name: "SMS Notifications",
            unit_amount_cents: 2900,
          },
        ],
        setup_fee_cents: 50000,
        monthly_discount_cents: 4900,
      },
    });

    expect(totals.initial_total_cents).toBe(50000);
    expect(totals.recurring_total_cents).toBe(17900);
    expect(calculateAmountDueFirstCycle(totals)).toBe(67900);
  });

  it("matches the shared offer totals calculator", () => {
    const draftItems = buildDraftOfferItemsForSummary({
      plan,
      products: [{ product_key: "website", name: "Website" }],
    });

    expect(calculateInviteOfferTotals({ plan, products: [] })).toEqual(
      calculateOfferTotals(draftItems.filter((item) => item.item_type === "base_plan")),
    );
  });

  it("requires a positive amount for custom plans", () => {
    expect(validateCustomPlanPrice("custom", 0)).toMatch(/greater than zero/i);
    expect(validateCustomPlanPrice("custom", 50000)).toBeNull();
    expect(validateCustomPlanPrice("launch", 0)).toBeNull();
  });
});

describe("inviteClientRequestSchema", () => {
  it("accepts a valid invite payload", () => {
    const parsed = inviteClientRequestSchema.safeParse({
      businessName: "MA5 Performance",
      contactName: "Alex",
      email: "owner@ma5.com",
      phone: "555-0100",
      websiteUrl: "https://ma5.com",
      domain: "ma5.com",
      planKey: "launch",
      monthlyPriceDollars: 149,
      productKeys: ["website", "client_portal"],
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts service add-ons and commercial extras", () => {
    const parsed = inviteClientRequestSchema.safeParse({
      businessName: "MA5 Performance",
      email: "owner@ma5.com",
      planKey: "launch",
      monthlyPriceDollars: 149,
      productKeys: ["website"],
      serviceAddOns: [{ productKey: "sms_notifications", monthlyPriceDollars: 29 }],
      setupFeeDollars: 500,
      monthlyDiscountDollars: 49,
    });

    expect(parsed.success).toBe(true);
  });

  it("allows platform component and related service add-on together", () => {
    const parsed = inviteClientRequestSchema.safeParse({
      businessName: "AI Co",
      email: "owner@ai.com",
      planKey: "launch",
      monthlyPriceDollars: 149,
      productKeys: ["ai_chatbot"],
      serviceAddOns: [{ productKey: "ai_chatbot_service", monthlyPriceDollars: 49 }],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects custom plans without a monthly amount", () => {
    const parsed = inviteClientRequestSchema.safeParse({
      businessName: "Custom Co",
      email: "owner@custom.com",
      planKey: "custom",
      monthlyPriceDollars: 0,
      productKeys: [],
    });

    expect(parsed.success).toBe(false);
  });
});
