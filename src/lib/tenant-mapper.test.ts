import { describe, expect, it } from "vitest";
import { mapTenantToClient } from "@/lib/tenant-mapper";

describe("mapTenantToClient client relationship date", () => {
  it("uses tenant creation rather than later portal-settings creation", () => {
    const client = mapTenantToClient({
      id: "tenant-1",
      slug: "example",
      display_name: "Example",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      tenant_portal_settings: {
        website_status: "live",
        created_at: "2026-08-31T00:00:00Z",
      },
      tenant_subscriptions: null,
    });
    expect(client.created_at).toBe("2026-01-01T00:00:00Z");
  });

  it("maps a new client without fake operational defaults", () => {
    const client = mapTenantToClient({
      id: "tenant-new",
      slug: "new-client",
      display_name: "New Client",
      status: "active",
      created_at: "2026-08-31T00:00:00Z",
      updated_at: "2026-08-31T00:00:00Z",
      tenant_portal_settings: {
        website_status: "not_set",
        hosting_status: "none",
        plan_inclusions: null,
        setup_inclusions: null,
      },
      tenant_subscriptions: null,
    });
    expect(client).toMatchObject({
      website_status: "not_set",
      domain: null,
      hosting_status: "none",
      website_security_status: null,
      website_security_https_enabled: null,
      website_security_cert_valid: null,
      plan_inclusions: [],
      setup_inclusions: [],
    });
  });

  it("preserves explicit Ton Tavern-style website configuration", () => {
    const client = mapTenantToClient({
      id: "tenant-ton",
      slug: "ton-tavern-fitness",
      display_name: "Ton Tavern Fitness",
      status: "active",
      created_at: "2026-08-31T00:00:00Z",
      updated_at: "2026-08-31T00:00:00Z",
      tenant_portal_settings: {
        website_status: "live",
        domain: "tontavernfitness.com",
        hosting_status: "active",
        website_security_status: "protected",
        website_security_https_enabled: true,
        website_security_cert_valid: true,
        plan_inclusions: ["Website", "Hosting"],
        setup_inclusions: ["Domain Transfer"],
      },
      tenant_subscriptions: null,
    });
    expect(client).toMatchObject({
      website_status: "live",
      domain: "tontavernfitness.com",
      hosting_status: "active",
      website_security_status: "protected",
      website_security_https_enabled: true,
      website_security_cert_valid: true,
      plan_inclusions: ["Website", "Hosting"],
      setup_inclusions: ["Domain Transfer"],
    });
  });
});
