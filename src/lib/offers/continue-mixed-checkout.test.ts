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
  getOffer: vi.fn(),
  sync: vi.fn(),
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
vi.mock("@/lib/offers/queries", () => ({
  getOfferWithItemsWithServiceClient: mocks.getOffer,
}));
vi.mock("@/lib/stripe-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe-sync")>();
  return {
    ...actual,
    syncClientFromCheckoutSession: mocks.sync,
  };
});

import { continueMixedCheckoutFromReturnedSession } from "@/lib/offers/continue-mixed-checkout";

function item(id: string, interval: "month" | "year"): ClientOfferItem {
  return {
    id,
    offer_id: "offer-1",
    tenant_id: "tenant-1",
    item_type: interval === "month" ? "base_plan" : "add_on",
    name: id,
    description: null,
    quantity: 1,
    unit_amount_cents: interval === "month" ? 50 : 50,
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
    subtotal_cents: 100,
    discount_total_cents: 0,
    amount_due_today_cents: 100,
    recurring_total_cents: 50,
    annual_recurring_total_cents: 50,
    checkout_state: "pending",
    monthly_checkout_session_id: null,
    annual_checkout_session_id: null,
    stripe_customer_id: "cus_1",
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
    url:
      args.status === "open"
        ? `https://checkout.stripe.com/c/pay/${args.id}`
        : null,
    customer: "cus_1",
    metadata: {
      tenant_id: "tenant-1",
      offer_id: "offer-1",
      purchase_id: "purchase-1",
      checkout_stage_index: String(args.stage),
      checkout_stage_count: "2",
      checkout_stage_cadence: args.cadence,
      checkout_stage_final: String(args.stage === 1),
    },
  } as unknown as Stripe.Checkout.Session;
}

const request = new Request("https://portal.test/billing/continue");
const offer = {
  id: "offer-1",
  tenant_id: "tenant-1",
  currency: "usd",
  billing_method: "stripe_checkout",
  items: [item("monthly", "month"), item("annual", "year")],
};

describe("mixed Checkout browser return", () => {
  beforeEach(() => {
    mocks.retrieve.mockReset();
    mocks.create.mockReset();
    mocks.findReusableOfferPurchase.mockReset();
    mocks.createPurchaseFromOffer.mockReset();
    mocks.getOffer.mockReset();
    mocks.sync.mockReset();
    mocks.updates.length = 0;
    mocks.sync.mockResolvedValue(undefined);
    mocks.getOffer.mockResolvedValue(offer);
  });

  it("reconciles monthly from Stripe before the webhook, then redirects to a new annual Checkout", async () => {
    const monthly = session({
      id: "cs_month",
      stage: 0,
      cadence: "month",
      status: "complete",
    });
    const annual = session({
      id: "cs_year",
      stage: 1,
      cadence: "year",
      status: "open",
    });
    mocks.findReusableOfferPurchase.mockResolvedValue(
      purchase({
        stripe_checkout_session_id: monthly.id,
        monthly_checkout_session_id: monthly.id,
        checkout_state: "pending",
      }),
    );
    mocks.retrieve.mockResolvedValue(monthly);
    mocks.create.mockResolvedValue(annual);

    const result = await continueMixedCheckoutFromReturnedSession({
      session: monthly,
      tenantId: "tenant-1",
      purchaserUserId: null,
      purchaserEmail: "client@example.com",
      request,
      returnContext: {
        kind: "public_proposal",
        token: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-",
      },
    });

    expect(mocks.sync).toHaveBeenCalledWith(monthly);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_annual", quantity: 1 }],
      metadata: {
        checkout_stage_cadence: "year",
        checkout_stage_final: "true",
      },
    });
    expect(mocks.create.mock.calls[0]?.[0].success_url).toContain(
      "/proposal/",
    );
    expect(mocks.sync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.create.mock.invocationCallOrder[0]!,
    );
    expect(result).toEqual({
      status: "redirect",
      url: "https://checkout.stripe.com/c/pay/cs_year",
    });
  });

  it("reuses the annual Checkout after the webhook and does not create another monthly subscription", async () => {
    const monthly = session({
      id: "cs_month",
      stage: 0,
      cadence: "month",
      status: "complete",
    });
    const annual = session({
      id: "cs_year",
      stage: 1,
      cadence: "year",
      status: "open",
    });
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

    const result = await continueMixedCheckoutFromReturnedSession({
      session: monthly,
      tenantId: "tenant-1",
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(mocks.sync).toHaveBeenCalledWith(monthly);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "redirect",
      url: "https://checkout.stripe.com/c/pay/cs_year",
    });
  });

  it("does not launch annual Checkout while Stripe still reports the monthly Session unpaid", async () => {
    const monthly = {
      ...session({
        id: "cs_month",
        stage: 0,
        cadence: "month",
        status: "complete",
      }),
      payment_status: "unpaid",
    } as Stripe.Checkout.Session;

    const result = await continueMixedCheckoutFromReturnedSession({
      session: monthly,
      tenantId: "tenant-1",
      purchaserUserId: "user-1",
      purchaserEmail: "client@example.com",
      request,
    });

    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "awaiting_confirmation" });
  });
});
