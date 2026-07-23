import { describe, expect, it } from "vitest";
import { buildInviteOfferItemRows } from "@/lib/catalog/build-invite-offer";
import { renderOfferSowHtml } from "@/lib/legal/offer-sow";

describe("renderOfferSowHtml", () => {
  it("fills client and commercial fields from invite data", () => {
    const items = buildInviteOfferItemRows({
      tenantId: "00000000-0000-4000-8000-000000000001",
      offerId: "00000000-0000-4000-8000-000000000002",
      plan: {
        plan_key: "launch",
        name: "Launch",
        monthly_price_cents: 14900,
        billing_interval: "month",
      },
      products: [
        { product_key: "website", name: "Website" },
        { product_key: "portal", name: "Client Portal" },
      ],
      extras: {
        setup_fee_cents: 50000,
        monthly_discount_cents: 4900,
        monthly_discount_duration_months: 6,
        paid_add_ons: [
          {
            product_key: "sms",
            name: "SMS Notifications",
            unit_amount_cents: 2900,
          },
        ],
      },
    });

    const html = renderOfferSowHtml({
      client: {
        businessName: "Acme Co",
        contactName: "Jane Doe",
        email: "jane@acme.com",
        phone: "555-0100",
        website: "https://acme.com",
        domain: "acme.com",
        planName: "Launch",
        projectStart: "2026-07-23",
      },
      offer: {
        title: "Acme Co — Launch",
        currency: "usd",
        subtotal_cents: 17800,
        discount_total_cents: 0,
        initial_total_cents: 50000,
        recurring_total_cents: 12900,
      },
      items: items.map((item, index) => ({
        ...item,
        id: `00000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })),
    });

    expect(html).toContain("Acme Co");
    expect(html).toContain("jane@acme.com");
    expect(html).toContain("Website");
    expect(html).toContain("SMS Notifications");
    expect(html).toContain("One-time onboarding charge");
    expect(html).toContain("Monthly discount");
    expect(html).toContain("$129.00");
  });
});
