import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getPrimaryClient: vi.fn(),
  getActiveOfferForTenant: vi.fn(),
  getLegalDocument: vi.fn(),
  hasAccepted: vi.fn(),
  recordAgreements: vi.fn(),
  recordOfferAcceptance: vi.fn(),
  createCheckout: vi.fn(),
  isStripeConfigured: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/data", () => ({ getPrimaryClient: mocks.getPrimaryClient }));
vi.mock("@/lib/offers/queries", () => ({
  getActiveOfferForTenant: mocks.getActiveOfferForTenant,
  getLegalDocument: mocks.getLegalDocument,
}));
vi.mock("@/lib/agreements/service", () => ({
  hasAcceptedRequiredOfferAgreements: mocks.hasAccepted,
  recordOfferAgreementsAcceptance: mocks.recordAgreements,
  recordOfferAcceptance: mocks.recordOfferAcceptance,
}));
vi.mock("@/lib/offers/checkout", () => ({
  createOfferCheckoutSession: mocks.createCheckout,
}));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: mocks.isStripeConfigured,
}));

import { POST } from "@/app/api/portal/agreements/accept/route";

const baseOffer = {
  id: "offer-1",
  tenant_id: "tenant-1",
  title: "MA5 Connect",
  status: "viewed",
  currency: "usd",
  requires_terms_acceptance: true,
  terms_document_id: "terms-1",
  sow_document_id: "sow-1",
  items: [
    {
      id: "item-1",
      offer_id: "offer-1",
      tenant_id: "tenant-1",
      item_type: "add_on",
      name: "MA5 Connect",
      quantity: 1,
      unit_amount_cents: 5999,
      billing_type: "recurring",
      billing_interval: "month",
      billing_interval_count: 1,
      is_selected: true,
      metadata: {},
    },
  ],
};

function request() {
  return new Request("https://clients.example/api/portal/agreements/accept", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-agent",
      "x-forwarded-for": "192.0.2.1",
    },
    body: JSON.stringify({
      acceptedName: "Mike Example",
      acceptedEmail: "mike@example.com",
      acceptTerms: true,
      acceptSow: true,
    }),
  });
}

describe("proposal acceptance billing method", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentProfile.mockResolvedValue({
      id: "user-1",
      email: "mike@example.com",
    });
    mocks.getPrimaryClient.mockResolvedValue({
      id: "tenant-1",
      stripe_customer_id: "cus_existing",
    });
    mocks.getLegalDocument.mockImplementation(async (id: string) => ({
      id,
      version: "1",
      title: id,
      document_type: id.startsWith("terms")
        ? "terms_of_service"
        : "statement_of_work",
      content_html: `<p>${id}</p>`,
    }));
    mocks.hasAccepted.mockResolvedValue(false);
    mocks.isStripeConfigured.mockReturnValue(true);
    mocks.createCheckout.mockResolvedValue({
      session: { url: "https://checkout.stripe.test/session" },
    });
  });

  it("records Proposal Only acceptance and stops before every Stripe entry point", async () => {
    mocks.getActiveOfferForTenant.mockResolvedValue({
      ...baseOffer,
      billing_method: "proposal_only",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      accepted: true,
      billingMethod: "proposal_only",
      checkoutUrl: null,
    });
    expect(mocks.recordAgreements).toHaveBeenCalledOnce();
    expect(mocks.recordAgreements).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        offerId: "offer-1",
        ipAddress: "192.0.2.1",
        userAgent: "test-agent",
        acceptanceSnapshot: expect.objectContaining({
          billing_method: "proposal_only",
          accepted_by_user_id: "user-1",
          totals: expect.objectContaining({ recurring_total_cents: 5999 }),
        }),
      }),
    );
    expect(mocks.isStripeConfigured).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("preserves legacy Stripe Checkout behavior when billing method is missing", async () => {
    mocks.getActiveOfferForTenant.mockResolvedValue(baseOffer);

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      checkoutUrl: "https://checkout.stripe.test/session",
    });
    expect(mocks.isStripeConfigured).toHaveBeenCalledOnce();
    expect(mocks.createCheckout).toHaveBeenCalledOnce();
  });
});

