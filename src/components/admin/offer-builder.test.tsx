import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferBuilder } from "@/components/admin/offer-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const catalogProps = {
  plans: [
    {
      id: "plan-1",
      plan_key: "launch",
      name: "Launch",
      description: null,
      default_price_cents: 19900,
      billing_interval: "month",
      sort_order: 1,
      is_active: true,
    },
  ],
  platformComponents: [
    {
      id: "product-1",
      product_key: "website",
      name: "Website",
      description: null,
      category: null,
      category_group: null,
      sort_order: 1,
      is_active: true,
    },
  ],
  serviceAddOns: [],
};

describe("OfferBuilder proposal presentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses proposal terminology and processor-neutral billing language", () => {
    const html = renderToStaticMarkup(
      <OfferBuilder
        tenantId="tenant-1"
        initialOffers={[]}
        contacts={[]}
        recipientDeliveries={[]}
        {...catalogProps}
      />,
    );

    expect(html).toContain("Create Proposal");
    expect(html).toContain("Proposal title");
    expect(html).toContain("Proposal summary");
    expect(html).toContain("Proposal scope");
    expect(html).toContain("Create &amp; Edit Proposal");
    expect(html).toContain("Online Payment / Subscription");
    expect(html).toContain("No proposals yet");
    expect(html).not.toContain("Create draft offer");
    expect(html).not.toContain("Stripe Checkout");
  });

  it("renders investment pricing workspace for draft proposals", () => {
    const html = renderToStaticMarkup(
      <OfferBuilder
        tenantId="tenant-1"
        initialOffers={[
          {
            id: "offer-1",
            tenant_id: "tenant-1",
            title: "Ton Tavern proposal",
            short_summary: null,
            plan_inclusions: [],
            setup_inclusions: [],
            description: null,
            status: "draft",
            billing_method: "stripe_checkout",
            currency: "usd",
            valid_from: null,
            expires_at: null,
            terms_document_id: null,
            sow_document_id: null,
            requires_terms_acceptance: true,
            subtotal_cents: 0,
            discount_total_cents: 0,
            initial_total_cents: 0,
            recurring_total_cents: 0,
            created_by: null,
            published_at: null,
            accepted_at: null,
            purchased_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: [],
            features: Array.from({ length: 15 }, (_, index) => ({
              id: `feature-${index}`,
              offer_id: "offer-1",
              tenant_id: "tenant-1",
              label: `Deliverable ${index + 1}`,
              sort_order: index,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
          },
        ]}
        contacts={[]}
        recipientDeliveries={[]}
        {...catalogProps}
      />,
    );

    expect(html).toContain("Investment / pricing");
    expect(html).toContain("Save pricing");
    expect(html).toContain("Scope &amp; deliverables");
    expect(html).toContain("Scope and deliverables");
    expect(html).toContain("Deliverable 1\nDeliverable 2");
    expect(html).toContain("Deliverable 15");
    expect(html).not.toContain("Add deliverable or feature");
    expect(html).not.toContain("Catalog product key");
  });
});
