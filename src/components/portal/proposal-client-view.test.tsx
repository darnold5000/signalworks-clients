import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalClientView } from "@/components/portal/proposal-client-view";
import type {
  ClientOffer,
  ClientOfferFeature,
  ClientOfferItem,
} from "@/lib/database/phase1-types";

const offer = {
  id: "internal-offer-id",
  tenant_id: "internal-tenant-id",
  title: "Mobile Apps with Wearables",
  short_summary: "Connected health and workout activity.",
  description: "Native apps for members.\n\nConnected coaching insights.",
  status: "draft",
  currency: "usd",
  requires_terms_acceptance: true,
} as ClientOffer;

const item = {
  id: "internal-item-id",
  offer_id: offer.id,
  tenant_id: offer.tenant_id,
  item_type: "add_on",
  name: "Connected Health Platform",
  description: "Ongoing mobile and wearable support",
  quantity: 1,
  unit_amount_cents: 9900,
  billing_type: "recurring",
  billing_interval: "month",
  billing_interval_count: 1,
  discount_type: null,
  discount_amount_cents: null,
  discount_percent: null,
  discount_duration_type: null,
  discount_duration_months: null,
  stripe_product_id: "prod_internal",
  stripe_price_id: "price_internal",
  stripe_coupon_id: null,
  is_optional: false,
  is_selected: true,
  sort_order: 0,
  metadata: { product_key: "catalog_internal" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as ClientOfferItem;

const features = [
  {
    id: "internal-feature-id",
    offer_id: offer.id,
    tenant_id: offer.tenant_id,
    label: "Apple Health integration",
    sort_order: 0,
  } as ClientOfferFeature,
];

describe("ProposalClientView", () => {
  it("renders proposal copy and ordered features in preview mode", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={[item]}
        features={features}
        preview
      />,
    );

    expect(html).toContain("Signal Works Digital");
    expect(html).toContain("Mobile Apps with Wearables");
    expect(html).toContain("Connected coaching insights");
    expect(html).toContain("Apple Health integration");
    expect(html).toContain("Checkout disabled in preview mode");
  });

  it("never renders internal catalog, database, or Stripe identifiers", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={[item]}
        features={features}
        preview
      />,
    );

    expect(html).not.toContain("internal-offer-id");
    expect(html).not.toContain("internal-tenant-id");
    expect(html).not.toContain("price_internal");
    expect(html).not.toContain("prod_internal");
    expect(html).not.toContain("catalog_internal");
  });
});
