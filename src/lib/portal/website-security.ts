import type { Client } from "@/lib/types";

export type WebsiteSecurityStatus =
  | "protected"
  | "needs_attention"
  | "issue_detected";

export const WEBSITE_SECURITY_LABELS: Record<WebsiteSecurityStatus, string> = {
  protected: "Protected",
  needs_attention: "Needs Attention",
  issue_detected: "Issue Detected",
};

export function resolveWebsiteSecurityStatus(
  client: Pick<Client, "website_security_status" | "ssl_status">,
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
    case "none":
    default:
      return "needs_attention";
  }
}

export function websiteSecurityTone(
  status: WebsiteSecurityStatus,
): "success" | "warning" | "danger" {
  if (status === "protected") return "success";
  if (status === "needs_attention") return "warning";
  return "danger";
}

export function websiteSecurityIcon(status: WebsiteSecurityStatus): string {
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
