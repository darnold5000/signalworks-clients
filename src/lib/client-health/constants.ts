/** Rollup and per-signal operational health states (cached checks). */
export const OPERATIONS_HEALTH_STATUSES = [
  "healthy",
  "warning",
  "critical",
  "unknown",
  "not_configured",
] as const;

export type OperationsHealthStatus = (typeof OPERATIONS_HEALTH_STATUSES)[number];

/** Provider keys refreshed independently (Resend omitted from v1). */
export const OPERATIONS_HEALTH_PROVIDERS = [
  "uptimerobot",
  "ssl",
  "domain",
  "vercel",
  "supabase",
  "twilio",
] as const;

export type OperationsHealthProvider =
  (typeof OPERATIONS_HEALTH_PROVIDERS)[number];

export const OPERATIONS_HEALTH_PROVIDER_LABELS: Record<
  OperationsHealthProvider,
  string
> = {
  uptimerobot: "UptimeRobot",
  ssl: "SSL",
  domain: "Domain & DNS",
  vercel: "Vercel",
  supabase: "Supabase",
  twilio: "Twilio",
};
