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
});
