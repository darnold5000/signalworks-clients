import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InviteClientPlatformComponentsSelect } from "@/components/invite-client-platform-components-select";

describe("InviteClientPlatformComponentsSelect pricing controls", () => {
  it("shows independent compact controls for catalog and custom components", () => {
    const html = renderToStaticMarkup(
      <InviteClientPlatformComponentsSelect
        components={[
          {
            id: "booking-id",
            product_key: "online_booking",
            name: "Online Booking",
            description: "Scheduling and availability",
            category: "operations",
            category_group: null,
            sort_order: 1,
            is_active: true,
          },
          {
            id: "other-id",
            product_key: "other",
            name: "Other",
            description: null,
            category: "custom",
            category_group: "custom",
            sort_order: 2,
            is_active: true,
          },
        ]}
        selectedKeys={["online_booking", "other"]}
        onChange={vi.fn()}
        pricingByKey={{
          online_booking: {
            pricingMode: "monthly",
            amountDollars: "15.00",
          },
        }}
        onPricingChange={vi.fn()}
        customRows={[
          {
            id: "custom-1",
            name: "Payment Integration",
            pricingMode: "one_time",
            amountDollars: "150.00",
          },
        ]}
        onCustomRowsChange={vi.fn()}
      />,
    );

    expect(html.match(/Pricing:/g)).toHaveLength(2);
    expect(html).toContain("Online Booking pricing mode");
    expect(html).toContain("Online Booking amount");
    expect(html).toContain("/mo");
    expect(html).toContain("Payment Integration pricing mode");
    expect(html).toContain("Payment Integration amount");
    expect(html).toContain("one-time");
    expect(html).toContain("+ Add another");
  });
});
