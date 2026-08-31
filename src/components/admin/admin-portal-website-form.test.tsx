import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminPortalWebsiteForm } from "@/components/admin/admin-portal-website-form";
import { DEMO_CLIENTS } from "@/lib/demo-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AdminPortalWebsiteForm", () => {
  it("renders unknown new-client facts without fake defaults", () => {
    const html = renderToStaticMarkup(
      <AdminPortalWebsiteForm
        client={{
          ...DEMO_CLIENTS[0]!,
          domain: null,
          hosting_status: "none",
          ssl_status: "none",
          website_security_status: null,
          website_security_https_enabled: null,
          website_security_cert_valid: null,
          website_security_cert_expires_at: null,
          plan_inclusions: [],
          setup_inclusions: [],
        }}
      />,
    );

    expect(html).toContain('placeholder="—"');
    expect(html).toContain("Not set");
    expect(html.match(/>Unknown<\/option>/g)).toHaveLength(2);
    expect(html).toContain("Not Assessed");
    expect(html).not.toContain("Domain Transfer");
    expect(html).not.toContain("Business Email Setup");
    expect(html).not.toContain('type="checkbox" checked');
  });
});
