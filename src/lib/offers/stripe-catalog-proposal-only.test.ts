import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";

const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { syncPublishedOfferCatalog } from "@/lib/offers/stripe-catalog";

describe("Proposal Only publication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns before constructing Stripe or touching the database", async () => {
    await syncPublishedOfferCatalog(
      { billing_method: "proposal_only" } as ClientOffer,
      [{} as ClientOfferItem],
    );

    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

