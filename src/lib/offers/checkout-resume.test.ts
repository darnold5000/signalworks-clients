import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type {
  ClientOfferItem,
  Purchase,
} from "@/lib/database/phase1-types";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  findReusableOfferPurchase: vi.fn(),
  createPurchaseFromOffer: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: { retrieve: mocks.retrieve, create: mocks.create },
    },
  }),
}));
vi.mock("@/lib/purchases/service", () => ({
  findReusableOfferPurchase: mocks.findReusableOfferPurchase,
  createPurchaseFromOffer: mocks.createPurchaseFromOffer,
}));
vi.mock("@/lib/site", () => ({ resolveAppUrl: () => "https://portal.test" }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => {
      const chain = {
        update: (value: Record<string, unknown>) => {
          mocks.updates.push(value);
          return chain;
        },
        eq: () => chain,
      };
      return chain;
    },
  }),
}));

import { createOfferCheckoutSession } from "@/lib/offers/checkout";

function item(id: string, interval: "month" | "year"): ClientOfferItem {
  return {
    id,
    offer_id: "offer-1",
    tenant_id: "tenant-1",
    item_type: interval === "month" ? "base_plan" : "add_on",
    name: id,
    description: null,
    quantity: 1,
    unit_amount_cents: interval === "month" ? 6_500 : 2_500,
    billing_type: "recurring",
    billing_interval: interval,
    billing_interval_count: 1,
    discount_type: null,
    discount_amount_cents: null,
    discount_percent: null,
    discount_duration_type: null,
    discount_duration_months: null,
    stripe_product_id: `prod_${id}`,
    stripe_price_id: `price_${id}`,
    stripe_coupon_id: null,
    is_optional: false,
    is_selected: true,
    sort_order: 0,
    metadata: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
}

function purchase(partial: Partial<Purchase> = {}): Purchase {
  return {
    id: "purchase-1",
    tenant_id: "tenant-1",
    offer_id: "offer-1",
    status: "checkout_created",
    currency: "usd",
    subtotal_cents: 9_000,
    discount_total_cents: 0,
    amount_due_today_cents: 9_000,
    recurring_total_cents: 6_500,
    annual_recurring_total_cents: 2_500,
    checkout_state: "pending",
    monthly_checkout_session_id: null,
    annual_checkout_session_id: null,
    stripe_customer_id: null,
    stripe_checkout_session_id: null,
    stripe_subscription_id: null,
    stripe_payment_intent_id: null,
    stripe_invoice_id: null,
    purchased_by: "user-1",
    purchased_at: null,
    purchase_snapshot: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...partial,
  };
}

function session(args: {
  id: string;
  stage: number;
  cadence: "month" | "year";
  status: "open" | "complete" | "expired";
}): Stripe.Checkout.Session {
  return {
    id: args.id,
    status: args.status,
    payment_status: args.status === "complete" ? "paid" : "unpaid",
    url: args.status === "open" ? `https://checkout.test/${args.id}` : null,
    customer: "cus_1",
    metadata: {
      checkout_stage_index: String(args.stage),
      checkout_stage_cadence: args.cadence,
      checkout_stage_final: String(args.stage === 1),
    },
  } as unknown as Stripe.Checkout.Session;
}

const request = new Request("https://portal.test/api/portal/offer/checkout");
const offer = {
  id: "offer-1",
  tenant_id: "tenant-1",
  currency: "usd",
  billing_method: "stripe_checkout",
  items: [item("monthly", "month"), item("annual", "year")],
} as Parameters<typeof createOfferCheckoutSession>[0]["offer"];

describe("mixed Checkout resume", () => {
  beforeEach(() => {
    mocks.retrieve.mockReset();
    mocks.create.mockReset();
    mocks.findReusableOfferPurchase.mockReset();
    mocks.createPurchaseFromOffer.mockReset();
    mocks.updates.length = 0;
  });

  it("resumes with annual after monthly succeeds without recreating monthly", async () => {
    const monthly = session({ id: "cs_month", stage: 0, cadence: "month", status: "complete" });
    mocks.findReusableOfferPurchase.mockResolvedValue(
      purchase({
        stripe_checkout_session_id: monthly.id,
        monthly_checkout_session_id: monthly.id,
      }),
    );
    mocks.retrieve.mockResolvedValue(monthly);
    mocks.create.mockResolvedValue(
      session({ id: "cs_year", stage: 1, cadence: "year", status: "open" }),
    );

    await createOfferCheckoutSession({
      offer,
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_annual", quantity: 1 }],
    });
    expect(mocks.create.mock.calls[0]?.[1]?.idempotencyKey).toContain(
      "checkout-stage:1",
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        checkout_state: "monthly_complete",
        annual_checkout_session_id: "cs_year",
      }),
    );
  });

  it("reuses an open annual Session on retry and creates no subscription", async () => {
    const monthly = session({ id: "cs_month", stage: 0, cadence: "month", status: "complete" });
    const annual = session({ id: "cs_year", stage: 1, cadence: "year", status: "open" });
    mocks.findReusableOfferPurchase.mockResolvedValue(
      purchase({
        stripe_checkout_session_id: annual.id,
        monthly_checkout_session_id: monthly.id,
        annual_checkout_session_id: annual.id,
        checkout_state: "monthly_complete",
      }),
    );
    mocks.retrieve.mockImplementation(async (id: string) =>
      id === annual.id ? annual : monthly,
    );

    const result = await createOfferCheckoutSession({
      offer,
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(result.session.id).toBe("cs_year");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("replaces only the failed annual attempt", async () => {
    const monthly = session({ id: "cs_month", stage: 0, cadence: "month", status: "complete" });
    const expiredAnnual = session({ id: "cs_year_old", stage: 1, cadence: "year", status: "expired" });
    mocks.findReusableOfferPurchase.mockResolvedValue(
      purchase({
        stripe_checkout_session_id: expiredAnnual.id,
        monthly_checkout_session_id: monthly.id,
        annual_checkout_session_id: expiredAnnual.id,
        checkout_state: "failed",
      }),
    );
    mocks.retrieve.mockImplementation(async (id: string) =>
      id === expiredAnnual.id ? expiredAnnual : monthly,
    );
    mocks.create.mockResolvedValue(
      session({ id: "cs_year_retry", stage: 1, cadence: "year", status: "open" }),
    );

    await createOfferCheckoutSession({
      offer,
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0].line_items).toEqual([
      { price: "price_annual", quantity: 1 },
    ]);
    expect(mocks.create.mock.calls[0]?.[1]?.idempotencyKey).toContain(
      "cs_year_old",
    );
  });

  it("returns complete only after both cadence Sessions are complete", async () => {
    const monthly = session({ id: "cs_month", stage: 0, cadence: "month", status: "complete" });
    const annual = session({ id: "cs_year", stage: 1, cadence: "year", status: "complete" });
    mocks.findReusableOfferPurchase.mockResolvedValue(
      purchase({
        stripe_checkout_session_id: annual.id,
        monthly_checkout_session_id: monthly.id,
        annual_checkout_session_id: annual.id,
        checkout_state: "complete",
      }),
    );
    mocks.retrieve.mockImplementation(async (id: string) =>
      id === annual.id ? annual : monthly,
    );

    const result = await createOfferCheckoutSession({
      offer,
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(result.session.id).toBe("cs_year");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps old monthly-only checkout as one stage", async () => {
    mocks.findReusableOfferPurchase.mockResolvedValue(purchase());
    mocks.create.mockResolvedValue(
      session({ id: "cs_month", stage: 0, cadence: "month", status: "open" }),
    );

    await createOfferCheckoutSession({
      offer: { ...offer, items: [item("monthly", "month")] },
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      success_url: "https://portal.test/billing/success?session_id={CHECKOUT_SESSION_ID}",
      metadata: { checkout_stage_count: "1", checkout_stage_final: "true" },
    });
  });
});
