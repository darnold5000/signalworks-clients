import { describe, expect, it } from "vitest";
import {
  canDeletePortalClientTenant,
  isPlatformAppTenantSlug,
} from "@/lib/admin/platform-tenant-guards";

describe("platform-tenant-guards", () => {
  it("blocks platform app slugs", () => {
    expect(isPlatformAppTenantSlug("ma5-performance")).toBe(true);
    expect(isPlatformAppTenantSlug("test-salon")).toBe(false);
  });

  it("allows deleting portal service tenants", () => {
    expect(
      canDeletePortalClientTenant({
        slug: "bloom-studio-salon",
        platformCategory: "services",
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks internal tenants", () => {
    const result = canDeletePortalClientTenant({
      slug: "signalworks",
      platformCategory: "internal",
    });
    expect(result.allowed).toBe(false);
  });
});
