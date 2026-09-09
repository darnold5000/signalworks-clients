import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  getPublicProposal: vi.fn(),
  findReusableOfferPurchase: vi.fn(),
}));

vi.mock("@/lib/proposals/public-access", () => ({
  getPublicProposal: mocks.getPublicProposal,
}));
vi.mock("@/lib/purchases/service", () => ({
  findReusableOfferPurchase: mocks.findReusableOfferPurchase,
}));

import {
  getPublicProposalCheckoutResume,
  getPublicProposalForCheckout,
  resolvePublicCheckoutSessionId,
  stripeSessionMatchesProposal,
} from "@/lib/proposals/public-checkout";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
const proposal = {
  recipient: {
    id: "recipient-1",
    email: "client@example.com",
    accepted_at: "2026-09-09T00:00:00Z",
  },
  offer: {
    id: "offer-1",
    tenant_id: "tenant-1",
    status: "checkout_started",
    items: [],
    features: [],
  },
  terms: null,
  sow: null,
};

describe("public proposal checkout access", () => {
  beforeEach(() => {
    mocks.getPublicProposal.mockReset();
    mocks.findReusableOfferPurchase.mockReset();
  });

  it("rejects invalid recipient tokens", async () => {
    expect(await getPublicProposalForCheckout("short")).toBeNull();
    expect(mocks.getPublicProposal).not.toHaveBeenCalled();
  });

  it("requires acceptance or an in-progress checkout offer", async () => {
    mocks.getPublicProposal.mockResolvedValue({
      ...proposal,
      recipient: { ...proposal.recipient, accepted_at: null },
      offer: { ...proposal.offer, status: "published" },
    });
    expect(await getPublicProposalForCheckout(token)).toBeNull();
  });

  it("allows checkout continuation for accepted recipients without portal auth", async () => {
    mocks.getPublicProposal.mockResolvedValue(proposal);
    await expect(getPublicProposalForCheckout(token)).resolves.toEqual(proposal);
  });

  it("rejects Stripe sessions that do not belong to the proposal offer", () => {
    const session = {
      metadata: { offer_id: "other-offer", tenant_id: "tenant-1" },
    } as unknown as Stripe.Checkout.Session;
    expect(
      stripeSessionMatchesProposal({
        session,
        offerId: "offer-1",
        tenantId: "tenant-1",
      }),
    ).toBe(false);
  });

  it("resumes annual setup from the stored monthly session without a query param", async () => {
    mocks.getPublicProposal.mockResolvedValue(proposal);
    mocks.findReusableOfferPurchase.mockResolvedValue({
      checkout_state: "monthly_complete",
      monthly_checkout_session_id: "cs_month",
      annual_recurring_total_cents: 50,
    });

    await expect(
      resolvePublicCheckoutSessionId({ token }),
    ).resolves.toEqual({
      proposal,
      sessionId: "cs_month",
    });
  });

  it("reports when annual setup is still required", async () => {
    mocks.findReusableOfferPurchase.mockResolvedValue({
      checkout_state: "monthly_complete",
      annual_recurring_total_cents: 50,
      status: "checkout_created",
    });

    await expect(
      getPublicProposalCheckoutResume({
        tenantId: "tenant-1",
        offerId: "offer-1",
      }),
    ).resolves.toEqual({
      needsAnnualSetup: true,
      needsCheckoutResume: true,
      purchaseComplete: false,
    });
  });
});
