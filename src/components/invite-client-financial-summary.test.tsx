import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InviteClientFinancialSummary } from "@/components/invite-client-financial-summary";

describe("InviteClientFinancialSummary platform pricing", () => {
  it("lists each capability and uses canonical totals for MRR, ARR, one-time, and first cycle", () => {
    const html = renderToStaticMarkup(
      <InviteClientFinancialSummary
        plan={{
          plan_key: "growth",
          name: "Growth",
          monthly_price_cents: 4999,
          billing_interval: "month",
        }}
        products={[
          { product_key: "portal", name: "Client Portal" },
          { product_key: "booking", name: "Online Booking" },
        ]}
        extras={{
          custom_platform_components: [
            {
              name: "Payment Platform Integration",
              pricing_mode: "monthly",
              unit_amount_cents: 2500,
            },
            {
              name: "Custom Setup",
              pricing_mode: "one_time",
              unit_amount_cents: 15000,
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Growth");
    expect(html).toContain("$49.99/mo");
    expect(html).toContain("Client Portal");
    expect(html).toContain("Online Booking");
    expect(html.match(/Included/g)).toHaveLength(2);
    expect(html).toContain("Payment Platform Integration");
    expect(html).toContain("$25.00/mo");
    expect(html).toContain("Custom Setup");
    expect(html).toContain("$150.00 one-time");
    expect(html).toContain("$74.99");
    expect(html).toContain("$899.88");
    expect(html).toContain("$224.99");
  });
});
