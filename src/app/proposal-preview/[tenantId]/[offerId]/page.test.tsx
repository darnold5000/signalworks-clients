import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, getOfferWithItems, getAdminClientBundle, createCheckout } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getOfferWithItems: vi.fn(),
  getAdminClientBundle: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin }));
vi.mock("@/lib/offers/queries", () => ({ getOfferWithItems }));
vi.mock("@/lib/admin/client-records", () => ({ getAdminClientBundle }));
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
    getAdminClientBundle.mockResolvedValue({
      client: {
        plan_inclusions: ["Website Security"],
        setup_inclusions: ["Domain Transfer"],
      },
    });
  });

  it("is admin-only and renders a draft without billing side effects", async () => {
    const page = await ProposalPreviewPage({
      params: Promise.resolve({ tenantId: "tenant-1", offerId: "offer-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(getOfferWithItems).toHaveBeenCalledWith("offer-1");
    expect(getAdminClientBundle).toHaveBeenCalledWith("tenant-1");
    expect(createCheckout).not.toHaveBeenCalled();
    expect(html).toContain("Preview mode");
    expect(html).toContain("Checkout disabled in preview mode");
    expect(html).toContain("Website Security");
    expect(html).toContain("Domain Transfer");
  });
});
