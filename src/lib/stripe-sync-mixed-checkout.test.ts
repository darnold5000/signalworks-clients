import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const writes = vi.hoisted(() => [] as Array<{
  table: string;
  operation: "update" | "upsert" | "insert";
  value: Record<string, unknown>;
}>);

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createServiceClient: () => ({
    from: (table: string) => {
      const chain = {
        update: (value: Record<string, unknown>) => {
          writes.push({ table, operation: "update" as const, value });
          return chain;
        },
        upsert: (value: Record<string, unknown>) => {
          writes.push({ table, operation: "upsert" as const, value });
          return chain;
        },
        insert: (value: Record<string, unknown>) => {
          writes.push({ table, operation: "insert" as const, value });
          return chain;
        },
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        in: () => chain,
        or: () => chain,
        is: () => chain,
        limit: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: { id: "purchase-1" } }),
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => null }));
vi.mock("@/lib/activity/log-tenant-activity", () => ({
  logTenantActivity: vi.fn(),
}));

import {
  syncClientFromCheckoutSession,
  syncClientFromFailedCheckoutSession,
} from "@/lib/stripe-sync";

function checkoutSession(args: {
  id: string;
  cadence: "month" | "year";
  final: boolean;
  paid?: boolean;
  status?: "complete" | "expired";
}): Stripe.Checkout.Session {
  return {
    id: args.id,
    mode: "subscription",
    status: args.status ?? "complete",
    payment_status: args.paid === false ? "unpaid" : "paid",
    customer: "cus_1",
    subscription: args.cadence === "month" ? "sub_month" : "sub_year",
    payment_intent: null,
    client_reference_id: "tenant-1",
    metadata: {
      tenant_id: "tenant-1",
      offer_id: "offer-1",
      purchase_id: "purchase-1",
      checkout_stage_cadence: args.cadence,
      checkout_stage_final: String(args.final),
    },
  } as unknown as Stripe.Checkout.Session;
}

describe("mixed Checkout webhook synchronization", () => {
  beforeEach(() => {
    writes.length = 0;
  });

  it("keeps the purchase partial after stage 1 succeeds", async () => {
    await syncClientFromCheckoutSession(
      checkoutSession({ id: "cs_month", cadence: "month", final: false }),
    );

    const purchaseWrite = writes.find(
      (write) => write.table === "purchases" && write.operation === "update",
    );
    expect(purchaseWrite?.value).toMatchObject({
      status: "checkout_created",
      checkout_state: "monthly_complete",
      monthly_checkout_session_id: "cs_month",
      stripe_subscription_id: "sub_month",
    });
    expect(purchaseWrite?.value).not.toHaveProperty("purchased_at");
    expect(
      writes.some(
        (write) =>
          write.table === "client_offers" &&
          write.value.status === "purchased",
      ),
    ).toBe(false);
  });

  it("records stage 2 failure as recoverable without completing purchase", async () => {
    await syncClientFromFailedCheckoutSession(
      checkoutSession({
        id: "cs_year_failed",
        cadence: "year",
        final: true,
        paid: false,
        status: "expired",
      }),
    );

    expect(writes).toContainEqual(
      expect.objectContaining({
        table: "purchases",
        operation: "update",
        value: expect.objectContaining({
          status: "checkout_created",
          checkout_state: "failed",
          annual_checkout_session_id: "cs_year_failed",
        }),
      }),
    );
    expect(writes).toContainEqual(
      expect.objectContaining({
        table: "purchase_items",
        operation: "update",
        value: { service_status: "failed" },
      }),
    );
  });

  it("does not activate an unpaid asynchronous Checkout completion", async () => {
    await syncClientFromCheckoutSession(
      checkoutSession({
        id: "cs_year_pending",
        cadence: "year",
        final: true,
        paid: false,
      }),
    );

    expect(writes).toEqual([]);
  });

  it("marks purchase and offer complete only after the final stage", async () => {
    await syncClientFromCheckoutSession(
      checkoutSession({ id: "cs_year", cadence: "year", final: true }),
    );

    expect(writes).toContainEqual(
      expect.objectContaining({
        table: "purchases",
        operation: "update",
        value: expect.objectContaining({
          status: "active",
          checkout_state: "complete",
          annual_checkout_session_id: "cs_year",
          purchased_at: expect.any(String),
        }),
      }),
    );
    expect(writes).toContainEqual(
      expect.objectContaining({
        table: "client_offers",
        operation: "update",
        value: expect.objectContaining({ status: "purchased" }),
      }),
    );
  });
});
