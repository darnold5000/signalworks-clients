import { siteConfig } from "@/lib/site";

export function isPublicAuditApiAuthorized(request: Request): boolean {
  const configuredKey = process.env.AUDIT_PUBLIC_API_KEY?.trim();
  if (!configuredKey) return true;

  const provided = request.headers.get("x-audit-api-key")?.trim();
  return provided === configuredKey;
}

export function publicAuditUnauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export function marketingResultsUrl(token: string): string {
  const base = siteConfig.marketingUrl.replace(/\/$/, "");
  return `${base}/audit/results/${token}`;
}
