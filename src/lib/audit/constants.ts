export const AUDIT_ENGINE_VERSION = "1.0.0";

export const AUDIT_SCOPE_VERSIONS = {
  public: "public-1",
  client_health: "client-health-1",
} as const;

export const AUDIT_USER_AGENT =
  "SignalWorksAuditBot/1.0 (+https://hiresignalworks.com/audit)";

export const AUDIT_RUN_STATUSES = [
  "queued",
  "running",
  "partially_succeeded",
  "succeeded",
  "failed",
] as const;

export const AUDIT_REQUEST_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const AUDIT_TYPES = [
  "public",
  "client_health",
  "technical",
  "seo",
  "aeo",
  "operations",
  "security",
  "performance",
] as const;

export const FINDING_CATEGORIES = [
  "performance",
  "technical",
  "seo",
  "local_seo",
  "aeo",
  "conversion",
  "accessibility",
  "security",
  "operations",
  "email_auth",
  "content",
] as const;

export const FINDING_STATUSES = [
  "pass",
  "warning",
  "fail",
  "unavailable",
  "manual_review",
] as const;

export const FINDING_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const SOURCE_TYPES = [
  "verified",
  "estimated_third_party",
  "automated",
  "manual_review",
] as const;

export const COLLECTOR_PHASES = [
  "queued",
  "collecting",
  "scoring",
  "recommendations",
  "complete",
] as const;

export const COLLECTOR_EXECUTION_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;

/** Per-collector execution timeouts (ms). */
export const COLLECTOR_TIMEOUT_MS = {
  http_hosting: 20_000,
  metadata: 10_000,
  robots_sitemap: 20_000,
  structured_data: 10_000,
  homepage_content: 30_000,
  pagespeed: 60_000,
  operations_inventory: 10_000,
} as const;

/** Default HTTP limits for outbound audit fetches. */
export const AUDIT_FETCH_LIMITS = {
  maxRedirects: 5,
  timeoutMs: 15_000,
  maxResponseBytes: 2 * 1024 * 1024,
  maxPages: 12,
} as const;
