import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalClientView } from "@/components/portal/proposal-client-view";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { recurringMonthlyDiscountMetadata } from "@/lib/offers/discount-scope";
import { formatMoney } from "@/lib/utils";
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

const recurringProduct = {
  id: "recurring-product-id",
  offer_id: offer.id,
  tenant_id: offer.tenant_id,
  item_type: "base_plan",
  name: "MA5 Connect — iOS, Android & Connected Fitness",
  description: null,
  quantity: 1,
  unit_amount_cents: 10999,
  billing_type: "recurring",
  billing_interval: "month",
  billing_interval_count: 1,
  discount_type: null,
  discount_amount_cents: null,
  discount_percent: null,
  discount_duration_type: null,
  discount_duration_months: null,
  stripe_product_id: "prod_ma5",
  stripe_price_id: "price_ma5",
  stripe_coupon_id: null,
  is_optional: false,
  is_selected: true,
  sort_order: 0,
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as ClientOfferItem;

const recurringDiscount = {
  id: "recurring-discount-id",
  offer_id: offer.id,
  tenant_id: offer.tenant_id,
  item_type: "discount",
  name: "Founding Partner Discount",
  description: "Ongoing founding partner pricing",
  quantity: 1,
  unit_amount_cents: 5000,
  billing_type: "one_time",
  billing_interval: null,
  billing_interval_count: 1,
  discount_type: "amount",
  discount_amount_cents: 5000,
  discount_percent: null,
  discount_duration_type: "forever",
  discount_duration_months: null,
  stripe_product_id: null,
  stripe_price_id: null,
  stripe_coupon_id: "coupon_internal",
  is_optional: false,
  is_selected: true,
  sort_order: 1,
  metadata: recurringMonthlyDiscountMetadata(),
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

  it("renders a title-only draft without inherited inclusions or fake totals", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={{
          ...offer,
          title: "Title only",
          short_summary: null,
          description: null,
          plan_inclusions: null,
          setup_inclusions: null,
        }}
        items={[]}
        features={[]}
        preview
      />,
    );

    expect(html).toContain("Title only");
    expect(html).not.toContain("Overview");
    expect(html).not.toContain("What&#x27;s Included");
    expect(html).not.toContain("Included with This Plan");
    expect(html).not.toContain("Included Setup");
    expect(html).not.toContain("Recurring monthly");
    expect(html).not.toContain("Due today");
    expect(html).not.toContain("$0.00");
  });

  it("renders only title and offer-owned description for an empty draft", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={{
          ...offer,
          title: "Draft title",
          short_summary: null,
          description: "Draft-specific description",
          plan_inclusions: [],
          setup_inclusions: [],
        }}
        items={[]}
        features={[]}
        preview
      />,
    );

    expect(html).toContain("Draft title");
    expect(html).toContain("Draft-specific description");
    expect(html).not.toContain("Website Security");
    expect(html).not.toContain("Business Email Setup");
  });

  it("preserves inclusions explicitly snapshotted on a purchased offer", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={{
          ...offer,
          status: "purchased",
          plan_inclusions: ["Historical hosting"],
          setup_inclusions: ["Historical migration"],
        }}
        items={[item]}
        features={[]}
      />,
    );

    expect(html).toContain("Historical hosting");
    expect(html).toContain("Historical migration");
  });

  it("renders only features attached to an add-on draft", () => {
    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={{
          ...offer,
          plan_inclusions: [],
          setup_inclusions: [],
        }}
        items={[item]}
        features={features}
        preview
      />,
    );

    expect(html).toContain("Apple Health integration");
    expect(html).not.toContain("Website");
    expect(html).not.toContain("Domain Transfer");
  });

  it("uses identical offer content in preview and the real client view", () => {
    const previewHtml = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={[item]}
        features={features}
        preview
      />,
    );
    const clientHtml = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={[item]}
        features={features}
        acceptance={<button type="button">Continue to checkout</button>}
      />,
    );

    for (const content of [
      "Mobile Apps with Wearables",
      "Connected health and workout activity.",
      "Connected coaching insights.",
      "Apple Health integration",
      "Connected Health Platform",
      "$99.00",
    ]) {
      expect(previewHtml).toContain(content);
      expect(clientHtml).toContain(content);
    }
    expect(previewHtml).toContain("Checkout disabled in preview mode");
    expect(clientHtml).toContain("Continue to checkout");
  });

  it("renders recurring discount lines under the product with duration and net totals", () => {
    const items = [recurringProduct, recurringDiscount];
    const totals = calculateOfferTotals(items);
    const dueToday = calculateAmountDueFirstCycle(totals);

    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={items}
        features={[]}
        preview
      />,
    );

    expect(html).toContain("MA5 Connect — iOS, Android &amp; Connected Fitness");
    expect(html).toContain("$109.99");
    expect(html).toContain("Founding Partner Discount");
    expect(html).toContain("-$50.00/month");
    expect(html).not.toContain(">Ongoing</p>");
    expect(html).toContain("Ongoing founding partner pricing");
    expect(html).toContain(
      formatMoney(totals.recurring_total_cents, offer.currency),
    );
    expect(html).toContain(formatMoney(dueToday, offer.currency));
    expect(html).not.toContain("recurring-discount-id");
    expect(html).not.toContain("coupon_internal");
    expect(html).not.toContain("price_ma5");
  });

  it("renders one-time scoped discounts without a monthly suffix", () => {
    const oneTimeDiscount = {
      ...recurringDiscount,
      id: "first-cycle-discount-id",
      name: "Launch credit",
      unit_amount_cents: 2500,
      discount_amount_cents: 2500,
      discount_duration_type: "once",
      description: null,
      sort_order: 1,
      metadata: { discount_scope: "first_cycle" },
    } as ClientOfferItem;

    const html = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={[recurringProduct, oneTimeDiscount]}
        features={[]}
        preview
      />,
    );

    expect(html).toContain("Launch credit");
    expect(html).toContain("-$25.00");
    expect(html).not.toContain("-$25.00/month");
    expect(html).toContain("First billing cycle");
  });

  it("shows identical investment pricing in preview and published client views", () => {
    const items = [recurringProduct, recurringDiscount];
    const previewHtml = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={items}
        features={[]}
        preview
      />,
    );
    const clientHtml = renderToStaticMarkup(
      <ProposalClientView
        offer={offer}
        items={items}
        features={[]}
        acceptance={<button type="button">Continue to checkout</button>}
      />,
    );

    for (const content of [
      "Founding Partner Discount",
      "-$50.00/month",
      "$59.99",
      "Recurring monthly",
      "Due today",
    ]) {
      expect(previewHtml).toContain(content);
      expect(clientHtml).toContain(content);
    }
  });
});
