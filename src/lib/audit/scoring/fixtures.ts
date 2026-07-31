import type { AuditFindingInput } from "@/lib/audit/types";
import type { GeneratedRecommendation } from "@/lib/audit/recommendations/generate";
import type { ScoringResult } from "@/lib/audit/scoring/score-audit";

export type AuditAnalysisResult = {
  scoring: ScoringResult;
  recommendations: GeneratedRecommendation[];
  recommendationCatalogVersion: string;
};

/**
 * Pest Solutions Indy–shaped fixture for scoring/recommendation acceptance tests.
 * Mirrors plausible collector output without a live network run.
 */
export function pestsolutionsIndyFixtureFindings(): AuditFindingInput[] {
  return [
    {
      category: "technical",
      checkKey: "technical.https.enforced",
      severity: "info",
      status: "pass",
      title: "HTTPS is used",
      summary: "The homepage is served over HTTPS.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "technical",
      checkKey: "technical.response.status",
      severity: "info",
      status: "pass",
      title: "HTTP status 200",
      summary: "The homepage returned a successful HTTP status.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "technical",
      checkKey: "technical.redirect.chain",
      severity: "low",
      status: "warning",
      title: "Redirect chain detected",
      summary: "The homepage redirected 1 time(s) before the final URL.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "seo",
      checkKey: "seo.title.present",
      severity: "info",
      status: "pass",
      title: "Page title present",
      summary: 'Title: "Pest Solutions Indy | Pest Control Indianapolis" (48 characters).',
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "seo",
      checkKey: "seo.meta_description.present",
      severity: "info",
      status: "pass",
      title: "Meta description present",
      summary: "Meta description is 72 characters.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "seo",
      checkKey: "seo.canonical.present",
      severity: "info",
      status: "pass",
      title: "Canonical URL present",
      summary: "Canonical URL: https://www.pestsolutionsindy.com/",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "seo",
      checkKey: "seo.h1.count",
      severity: "info",
      status: "pass",
      title: "H1 heading count: 1",
      summary: 'Single H1 found: "Pest Control in Indianapolis".',
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "local_seo",
      checkKey: "seo.localbusiness_schema.present",
      severity: "info",
      status: "pass",
      title: "LocalBusiness schema detected",
      summary: "At least one LocalBusiness JSON-LD node was found.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "local_seo",
      checkKey: "seo.localbusiness_schema.phone",
      severity: "info",
      status: "pass",
      title: "LocalBusiness phone present",
      summary: "The LocalBusiness schema includes a phone number.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "seo",
      checkKey: "seo.sitemap.present",
      severity: "info",
      status: "pass",
      title: "XML sitemap found",
      summary: "Sitemap discovered at https://www.pestsolutionsindy.com/sitemap.xml.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "conversion",
      checkKey: "conversion.contact.visible",
      severity: "info",
      status: "pass",
      title: "Contact information visible on homepage",
      summary: "Detected phone on the homepage.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "conversion",
      checkKey: "conversion.primary_cta.present",
      severity: "info",
      status: "pass",
      title: "Primary CTA language detected",
      summary: "Homepage copy includes common call-to-action phrases.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "security",
      checkKey: "security.headers.basic",
      severity: "info",
      status: "pass",
      title: "Basic security headers",
      summary: "3 of 5 common security headers were detected.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
    {
      category: "performance",
      checkKey: "performance.pagespeed.unconfigured",
      severity: "low",
      status: "unavailable",
      title: "PageSpeed Insights not configured",
      summary:
        "Google PageSpeed Insights API key is not configured. Performance metrics were not collected.",
      sourceType: "estimated_third_party",
      sourceLabel: "Google PageSpeed Insights",
    },
    {
      category: "content",
      checkKey: "content.homepage.thin_content",
      severity: "medium",
      status: "warning",
      title: "Homepage content appears thin",
      summary: "The visible homepage text content is relatively short.",
      sourceType: "automated",
      sourceLabel: "Automated website check",
    },
  ];
}

export function allPassFixtureFindings(): AuditFindingInput[] {
  return pestsolutionsIndyFixtureFindings().map((finding) => ({
    ...finding,
    status: finding.status === "unavailable" ? "unavailable" : "pass",
    severity: "info",
  }));
}
