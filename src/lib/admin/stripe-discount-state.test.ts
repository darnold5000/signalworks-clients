import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieve = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve } }) }));

import { getStripeFiniteDiscountState } from "@/lib/admin/stripe-discount-state";

describe("Stripe finite discount state", () => {
  beforeEach(() => retrieve.mockReset());

  it("uses an expanded current Stripe discount and its authoritative end", async () => {
    const end = Math.floor(Date.now() / 1000) + 3600;
    retrieve.mockResolvedValue({
      discounts: [{ end, source: { coupon: { metadata: { offer_item_id: "discount-1" } } } }],
      items: { data: [] },
    });

    await expect(getStripeFiniteDiscountState("sub_1", ["discount-1"])).resolves.toEqual({
      "discount-1": { active: true, endsAt: new Date(end * 1000).toISOString() },
    });
  });

  it("marks a known offer discount ended when Stripe no longer attaches it", async () => {
    retrieve.mockResolvedValue({ discounts: [], items: { data: [] } });
    await expect(getStripeFiniteDiscountState("sub_1", ["discount-1"])).resolves.toEqual({
      "discount-1": { active: false, endsAt: null },
    });
  });
});
