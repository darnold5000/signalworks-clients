import type { Client } from "@/lib/types";

export type WebsiteSecurityStatus =
  | "not_assessed"
  | "protected"
  | "needs_attention"
  | "issue_detected";

export const WEBSITE_SECURITY_LABELS: Record<WebsiteSecurityStatus, string> = {
  not_assessed: "Not Assessed",
  protected: "Protected",
  needs_attention: "Needs Attention",
  issue_detected: "Issue Detected",
};

export function resolveWebsiteSecurityStatus(
  client: Pick<
    Client,
    | "website_security_status"
    | "website_security_https_enabled"
    | "website_security_cert_valid"
    | "website_security_cert_expires_at"
    | "ssl_status"
  >,
): WebsiteSecurityStatus {
  if (client.website_security_status) {
    return client.website_security_status;
  }
  switch (client.ssl_status) {
    case "active":
      return "protected";
    case "error":
      return "issue_detected";
    case "pending":
      return "needs_attention";
    case "none":
    default:
      return client.website_security_https_enabled != null ||
        client.website_security_cert_valid != null ||
        client.website_security_cert_expires_at != null
        ? "needs_attention"
        : "not_assessed";
  }
}

export function websiteSecurityTone(
  status: WebsiteSecurityStatus,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "not_assessed") return "neutral";
  if (status === "protected") return "success";
  if (status === "needs_attention") return "warning";
  return "danger";
}

export function websiteSecurityIcon(status: WebsiteSecurityStatus): string {
  if (status === "not_assessed") return "—";
  if (status === "protected") return "✅";
  if (status === "needs_attention") return "⚠️";
  return "❌";
}

export function formatCertExpirySummary(
  expiresAt: string | null | undefined,
  now = new Date(),
): string | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return "Certificate expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}
