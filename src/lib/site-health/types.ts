export type SiteHealthStatus =
  | "healthy"
  | "needs_attention"
  | "not_configured"
  | "checking"
  | "error";

export type SiteCheckState = "pass" | "warning" | "fail" | "not_configured";

export type SiteHealthCheck = {
  key: string;
  label: string;
  state: SiteCheckState;
  explanation: string;
  recommendation?: string;
  evidence?: string;
};

export type SiteHealthResult = {
  status: Exclude<SiteHealthStatus, "checking">;
  checkedAt: string;
  durationMs: number;
  configuredUrl: string;
  finalUrl: string | null;
  canonicalUrl: string | null;
  primaryHostname: string;
  alternateHostname: string;
  sitemapUrl: string;
  sitemapUrlCount: number | null;
  robotsUrl: string;
  checks: SiteHealthCheck[];
};

export const MANUAL_CHECKLIST_KEYS = [
  "dns_ownership_confirmed",
  "search_console_property_created",
  "sitemap_submitted",
  "live_url_test_passed",
  "indexing_requested",
] as const;

export type ManualChecklistKey = (typeof MANUAL_CHECKLIST_KEYS)[number];
export type LaunchChecklistState = Partial<Record<ManualChecklistKey, boolean>>;

export type SiteHealthRecord = {
  tenant_id: string;
  search_console_status: "not_configured" | "manual_setup" | "connected";
  search_console_property: string | null;
  last_check_status: Exclude<SiteHealthStatus, "checking">;
  last_checked_at: string | null;
  last_check_duration_ms: number | null;
  last_check_results: SiteHealthResult | Record<string, unknown>;
  launch_checklist: LaunchChecklistState;
};

export type SiteHealthSite = {
  tenantId: string;
  name: string;
  slug: string;
  configuredUrl: string | null;
  configuredDomain: string | null;
  record: SiteHealthRecord | null;
};
