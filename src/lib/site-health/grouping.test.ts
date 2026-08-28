import { describe, expect, it } from "vitest";
import {
  groupSiteHealthSites,
  normalizeProductionHostname,
} from "@/lib/site-health/service";
import type { SiteHealthRecord, SiteHealthTenant } from "@/lib/site-health/types";

function tenant(
  tenantId: string,
  name: string,
  configuredUrl: string | null,
  monitoringEnabled = true,
): SiteHealthTenant {
  const record: SiteHealthRecord | null = monitoringEnabled
    ? null
    : {
      tenant_id: tenantId,
      monitoring_enabled: false,
      search_console_status: "not_configured",
      search_console_property: null,
      last_check_status: "not_configured",
      last_checked_at: null,
      last_check_duration_ms: null,
      last_check_results: {},
      launch_checklist: {},
    };
  return {
    tenantId,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    configuredUrl,
    configuredDomain: configuredUrl ? normalizeProductionHostname(configuredUrl) : null,
    record,
  };
}

describe("Site Health website grouping", () => {
  it("normalizes scheme, www, and trailing slash", () => {
    expect(normalizeProductionHostname("http://WWW.Example.com/")).toBe("example.com");
    expect(normalizeProductionHostname("https://example.com")).toBe("example.com");
  });

  it("groups tenants only when configured hostnames match", () => {
    const groups = groupSiteHealthSites([
      tenant("ma5", "MA5", "https://www.ma5performance.com/"),
      tenant("ma5-app", "MA5 Performance", "http://ma5performance.com"),
      tenant("other", "MA5 Legacy Name", "https://different.example/"),
    ]);
    expect(groups).toHaveLength(2);
    const ma5 = groups.find((group) => group.normalizedHostname === "ma5performance.com");
    expect(ma5?.name).toBe("MA5 Performance");
    expect(ma5?.associatedTenants.map((item) => item.tenantId)).toEqual(["ma5", "ma5-app"]);
  });

  it("does not group unconfigured tenants even when names are similar", () => {
    const groups = groupSiteHealthSites([
      tenant("dawg", "Dawg", null),
      tenant("dawg-app", "DAWG Youth Training", null),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps a shared website monitored while any associated tenant is enabled", () => {
    const groups = groupSiteHealthSites([
      tenant("one", "One", "https://example.com", false),
      tenant("two", "Two", "https://www.example.com", true),
    ]);
    expect(groups[0].monitoringEnabled).toBe(true);
  });

  it("marks a group excluded when every associated tenant is disabled", () => {
    const groups = groupSiteHealthSites([
      tenant("one", "One", "https://example.com", false),
      tenant("two", "Two", "https://www.example.com", false),
    ]);
    expect(groups[0].monitoringEnabled).toBe(false);
  });

  it("flags Vercel deployment hostnames without changing them", () => {
    const [site] = groupSiteHealthSites([
      tenant("dawg", "Dawg", "https://dawg-ashen.vercel.app/"),
    ]);
    expect(site.isPreviewDomain).toBe(true);
    expect(site.configuredUrl).toBe("https://dawg-ashen.vercel.app/");
  });
});
