import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const insert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => ({ insert }) }),
}));

import { claimStripeWebhookEvent } from "@/lib/stripe/webhook-idempotency";

describe("Stripe webhook idempotency", () => {
  it("treats an already-claimed Stripe event as a duplicate", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const event = {
      id: "evt_repeat",
      type: "checkout.session.completed",
      livemode: false,
    } as Stripe.Event;

    await expect(claimStripeWebhookEvent(event)).resolves.toEqual({
      duplicate: true,
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
