import { thirdPartyFinding } from "@/lib/audit/collectors/shared/finding";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "pagespeed";

function scoreStatus(score: number | null): AuditFindingInput["status"] {
  if (score == null) return "unavailable";
  if (score >= 90) return "pass";
  if (score >= 50) return "warning";
  return "fail";
}

function scoreSeverity(score: number | null): AuditFindingInput["severity"] {
  if (score == null) return "medium";
  if (score >= 90) return "info";
  if (score >= 50) return "medium";
  return "high";
}

function metricStatus(
  value: number | null,
  goodThreshold: number,
  poorThreshold: number,
): AuditFindingInput["status"] {
  if (value == null) return "unavailable";
  if (value <= goodThreshold) return "pass";
  if (value <= poorThreshold) return "warning";
  return "fail";
}

export const pagespeedCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: () => true,

  async collect(context) {
    const findings: AuditFindingInput[] = [];
    const client = context.services.pagespeed;

    if (!client.isConfigured()) {
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          thirdPartyFinding({
            category: "performance",
            checkKey: "performance.pagespeed.unconfigured",
            severity: "low",
            status: "unavailable",
            title: "PageSpeed Insights not configured",
            summary:
              "Google PageSpeed Insights API key is not configured. Performance metrics were not collected.",
            evidenceJson: { configured: false },
          }),
        ],
      };
    }

    let analysis;
    try {
      analysis = await client.analyze(context.url.normalizedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "PageSpeed request failed";
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          thirdPartyFinding({
            category: "performance",
            checkKey: "performance.pagespeed.request_failed",
            severity: "medium",
            status: "unavailable",
            title: "PageSpeed Insights request failed",
            summary: message,
          }),
        ],
        errorCode: "pagespeed_request_failed",
        errorMessage: message,
      };
    }

    if (!analysis) {
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          thirdPartyFinding({
            category: "performance",
            checkKey: "performance.pagespeed.no_data",
            severity: "medium",
            status: "unavailable",
            title: "PageSpeed Insights returned no data",
            summary: "The PageSpeed API did not return usable performance data.",
          }),
        ],
        errorCode: "pagespeed_no_data",
      };
    }

    findings.push(
      thirdPartyFinding({
        category: "performance",
        checkKey: "performance.mobile.score",
        severity: scoreSeverity(analysis.mobile.score),
        status: scoreStatus(analysis.mobile.score),
        title: `Mobile performance score: ${analysis.mobile.score ?? "n/a"}`,
        summary: "Lab data from Google PageSpeed Insights (mobile strategy).",
        evidenceJson: {
          dataSource: "lab",
          strategy: "mobile",
          score: analysis.mobile.score,
        },
      }),
      thirdPartyFinding({
        category: "performance",
        checkKey: "performance.desktop.score",
        severity: scoreSeverity(analysis.desktop.score),
        status: scoreStatus(analysis.desktop.score),
        title: `Desktop performance score: ${analysis.desktop.score ?? "n/a"}`,
        summary: "Lab data from Google PageSpeed Insights (desktop strategy).",
        evidenceJson: {
          dataSource: "lab",
          strategy: "desktop",
          score: analysis.desktop.score,
        },
      }),
      thirdPartyFinding({
        category: "performance",
        checkKey: "performance.mobile.lcp",
        severity: "medium",
        status: metricStatus(analysis.mobile.lcpMs, 2500, 4000),
        title: `Mobile LCP: ${analysis.mobile.lcpMs ?? "n/a"} ms`,
        summary: "Largest Contentful Paint from PageSpeed lab data (mobile).",
        evidenceJson: {
          dataSource: "lab",
          metric: "lcp",
          valueMs: analysis.mobile.lcpMs,
        },
      }),
      thirdPartyFinding({
        category: "performance",
        checkKey: "performance.mobile.cls",
        severity: "medium",
        status: metricStatus(analysis.mobile.cls, 0.1, 0.25),
        title: `Mobile CLS: ${analysis.mobile.cls ?? "n/a"}`,
        summary: "Cumulative Layout Shift from PageSpeed lab data (mobile).",
        evidenceJson: {
          dataSource: "lab",
          metric: "cls",
          value: analysis.mobile.cls,
        },
      }),
      thirdPartyFinding({
        category: "performance",
        checkKey: "performance.field_data.available",
        severity: "info",
        status: analysis.mobile.fieldDataAvailable ? "pass" : "warning",
        title: analysis.mobile.fieldDataAvailable
          ? "Chrome field data available"
          : "Chrome field data not available",
        summary: analysis.mobile.fieldDataAvailable
          ? "PageSpeed returned field (real-user) data for this URL."
          : "PageSpeed did not return field data; scores are lab-based estimates.",
        evidenceJson: { fieldDataAvailable: analysis.mobile.fieldDataAvailable },
      }),
    );

    if (analysis.opportunities.length > 0) {
      findings.push(
        thirdPartyFinding({
          category: "performance",
          checkKey: "performance.opportunities.present",
          severity: "low",
          status: "warning",
          title: `${analysis.opportunities.length} performance opportunities detected`,
          summary: analysis.opportunities.map((item) => item.title).join("; "),
          evidenceJson: { opportunities: analysis.opportunities },
        }),
      );
    }

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        mobileScore: analysis.mobile.score,
        desktopScore: analysis.desktop.score,
        fieldDataAvailable: analysis.mobile.fieldDataAvailable,
      },
    };
  },
};
