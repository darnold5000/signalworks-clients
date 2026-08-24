import { siteConfig } from "@/lib/site";

let loggedMissingProductionKey = false;

export function isPublicAuditApiAuthorized(request: Request): boolean {
  const configuredKey = process.env.AUDIT_PUBLIC_API_KEY?.trim();

  if (!configuredKey) {
    if (process.env.NODE_ENV === "production") {
      if (!loggedMissingProductionKey) {
        console.error(
          "[audit/public-auth] AUDIT_PUBLIC_API_KEY is not configured in production; denying public audit API requests.",
        );
        loggedMissingProductionKey = true;
      }
      return false;
    }
    return true;
  }

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
