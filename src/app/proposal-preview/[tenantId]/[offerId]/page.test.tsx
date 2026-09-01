import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, getOfferWithItems, getOfferTenantDisplayName, createCheckout } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getOfferWithItems: vi.fn(),
  getOfferTenantDisplayName: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin }));
vi.mock("@/lib/offers/queries", () => ({
  getOfferWithItems,
  getOfferTenantDisplayName,
}));
vi.mock("@/lib/offers/checkout", () => ({
  createOfferCheckoutSession: createCheckout,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));

import ProposalPreviewPage from "@/app/proposal-preview/[tenantId]/[offerId]/page";

describe("proposal preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOfferWithItems.mockResolvedValue({
      id: "offer-1",
      tenant_id: "tenant-1",
      title: "Draft proposal",
      short_summary: null,
      description: null,
      status: "draft",
      currency: "usd",
      requires_terms_acceptance: true,
      items: [],
      features: [],
    });
    getOfferTenantDisplayName.mockResolvedValue("Acme Fitness");
  });

  it("is admin-only and renders a draft without billing side effects", async () => {
    const page = await ProposalPreviewPage({
      params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(getOfferWithItems).toHaveBeenCalledWith("offer-1");
    expect(createCheckout).not.toHaveBeenCalled();
    expect(html).toContain("Preview mode");
    expect(html).toContain("Prepared for Acme Fitness");
    expect(html).toContain("Checkout disabled in preview mode");
    expect(html).not.toContain("Website Security");
    expect(html).not.toContain("Domain Transfer");
    expect(html).not.toContain("Recurring monthly");
    expect(html).not.toContain("$0.00");
  });

  it("requires admin authentication before loading proposal data", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("redirect to login"));

    await expect(
      ProposalPreviewPage({
        params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
      }),
    ).rejects.toThrow("redirect to login");
    expect(getOfferWithItems).not.toHaveBeenCalled();
    expect(getOfferTenantDisplayName).not.toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("rejects an offer from another tenant before rendering", async () => {
    getOfferWithItems.mockResolvedValue({
      id: "offer-1",
      tenant_id: "tenant-2",
      status: "draft",
      items: [],
      features: [],
    });

    await expect(
      ProposalPreviewPage({
        params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
      }),
    ).rejects.toThrow("not found");
    expect(getOfferTenantDisplayName).not.toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("renders Proposal Only preview without checkout language", async () => {
    getOfferWithItems.mockResolvedValue({
      id: "offer-1",
      tenant_id: "tenant-1",
      title: "Proposal-only draft",
      status: "draft",
      billing_method: "proposal_only",
      currency: "usd",
      requires_terms_acceptance: true,
      items: [],
      features: [],
    });

    const page = await ProposalPreviewPage({
      params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Accept Proposal (disabled in preview mode)");
    expect(html).not.toContain("Checkout disabled in preview mode");
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
