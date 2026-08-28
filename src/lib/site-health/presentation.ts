import type { SiteHealthStatus } from "@/lib/site-health/types";

export function siteHealthLabel(status: SiteHealthStatus) {
  return ({
    healthy: "Healthy",
    needs_attention: "Needs Attention",
    not_configured: "Not Configured",
    checking: "Checking",
    error: "Error",
  } satisfies Record<SiteHealthStatus, string>)[status];
}

export function siteHealthTone(status: SiteHealthStatus) {
  if (status === "healthy") return "success" as const;
  if (status === "needs_attention" || status === "checking") return "warning" as const;
  if (status === "error") return "danger" as const;
  return "neutral" as const;
}

export function currentSiteHealthStatus(
  configuredUrl: string | null,
  savedStatus?: string | null,
): SiteHealthStatus {
  if (!configuredUrl) return "not_configured";
  if (savedStatus === "healthy" || savedStatus === "needs_attention" || savedStatus === "error") {
    return savedStatus;
  }
  return "not_configured";
}
