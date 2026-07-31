import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "http_hosting";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const httpHostingCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: () => true,

  async collect(context) {
    const findings: AuditFindingInput[] = [];

    let response;
    try {
      response = await context.services.fetchPage(context.url.normalizedUrl);
      context.services.primeHomepage(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      findings.push(
        automatedFinding({
          category: "technical",
          checkKey: "technical.http.unreachable",
          severity: "critical",
          status: "fail",
          title: "Homepage is unreachable",
          summary: `The audit could not fetch the homepage: ${message}`,
          evidenceJson: { url: context.url.normalizedUrl },
        }),
      );
      return {
        collectorKey: COLLECTOR_KEY,
        findings,
        errorCode: "homepage_unreachable",
        errorMessage: message,
      };
    }

    const bodyBytes = Buffer.byteLength(response.bodyText, "utf8");
    const httpsEnforced =
      context.url.normalizedUrl.startsWith("https://") &&
      response.finalUrl.startsWith("https://");

    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "technical.https.enforced",
        severity: httpsEnforced ? "info" : "high",
        status: httpsEnforced ? "pass" : "fail",
        title: httpsEnforced ? "HTTPS is used" : "HTTPS is not enforced",
        summary: httpsEnforced
          ? "The homepage is served over HTTPS."
          : "The homepage is not consistently served over HTTPS.",
        evidenceJson: {
          requestedUrl: context.url.normalizedUrl,
          finalUrl: response.finalUrl,
        },
      }),
    );

    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "technical.response.status",
        severity: response.status >= 400 ? "high" : "info",
        status: response.status >= 200 && response.status < 400 ? "pass" : "fail",
        title: `HTTP status ${response.status}`,
        summary:
          response.status >= 200 && response.status < 400
            ? "The homepage returned a successful HTTP status."
            : "The homepage returned an error HTTP status.",
        evidenceJson: { status: response.status, finalUrl: response.finalUrl },
      }),
    );

    if (response.redirectChain.length > 1) {
      findings.push(
        automatedFinding({
          category: "technical",
          checkKey: "technical.redirect.chain",
          severity: response.redirectChain.length > 3 ? "medium" : "low",
          status: "warning",
          title: "Redirect chain detected",
          summary: `The homepage redirected ${response.redirectChain.length - 1} time(s) before the final URL.`,
          evidenceJson: { redirectChain: response.redirectChain },
        }),
      );
    } else {
      findings.push(
        automatedFinding({
          category: "technical",
          checkKey: "technical.redirect.chain",
          severity: "info",
          status: "pass",
          title: "No redirect chain",
          summary: "The homepage did not require redirects.",
          evidenceJson: { finalUrl: response.finalUrl },
        }),
      );
    }

    const compression = response.headers["content-encoding"];
    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "technical.compression.enabled",
        severity: compression ? "info" : "medium",
        status: compression ? "pass" : "warning",
        title: compression ? "Response compression enabled" : "Response compression not detected",
        summary: compression
          ? `Compression header detected (${compression}).`
          : "No content-encoding header was detected on the homepage response.",
        evidenceJson: { contentEncoding: compression ?? null },
      }),
    );

    const cacheControl = response.headers["cache-control"];
    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "technical.cache.headers",
        severity: cacheControl ? "info" : "low",
        status: cacheControl ? "pass" : "warning",
        title: cacheControl ? "Cache-Control header present" : "Cache-Control header missing",
        summary: cacheControl
          ? "The homepage response includes cache directives."
          : "No Cache-Control header was detected on the homepage response.",
        evidenceJson: { cacheControl: cacheControl ?? null },
      }),
    );

    const securityHeaders = [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
    ];
    const present = securityHeaders.filter((header) => response.headers[header]);
    findings.push(
      automatedFinding({
        category: "security",
        checkKey: "security.headers.basic",
        severity: present.length >= 3 ? "info" : "medium",
        status: present.length >= 2 ? "pass" : "warning",
        title: "Basic security headers",
        summary: `${present.length} of ${securityHeaders.length} common security headers were detected.`,
        evidenceJson: { present, checked: securityHeaders },
      }),
    );

    const pageSizeStatus = bodyBytes > 1.5 * 1024 * 1024 ? "warning" : "pass";
    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "technical.page_size",
        severity: bodyBytes > 2 * 1024 * 1024 ? "medium" : "info",
        status: pageSizeStatus,
        title: `Homepage size ${formatBytes(bodyBytes)}`,
        summary:
          bodyBytes > 1.5 * 1024 * 1024
            ? "The homepage HTML payload is relatively large."
            : "The homepage HTML payload size looks reasonable.",
        evidenceJson: { bytes: bodyBytes },
      }),
    );

    try {
      const finalHost = new URL(response.finalUrl).hostname.replace(/^www\./, "");
      const canonicalMatch = finalHost === context.url.normalizedDomain;
      findings.push(
        automatedFinding({
          category: "technical",
          checkKey: "technical.canonical.hostname",
          severity: canonicalMatch ? "info" : "low",
          status: canonicalMatch ? "pass" : "warning",
          title: canonicalMatch
            ? "Final hostname matches audited domain"
            : "Final hostname differs from audited domain",
          summary: canonicalMatch
            ? "The final URL hostname matches the audited domain."
            : `Final hostname (${finalHost}) differs from audited domain (${context.url.normalizedDomain}).`,
          evidenceJson: {
            finalHost,
            auditedDomain: context.url.normalizedDomain,
          },
        }),
      );
    } catch {
      // Ignore URL parse issues on final URL.
    }

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        status: response.status,
        finalUrl: response.finalUrl,
        redirectCount: response.redirectChain.length - 1,
        bodyBytes,
      },
    };
  },
};
