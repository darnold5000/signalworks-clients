import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "robots_sitemap";
const MAX_SITEMAP_URLS_TO_SAMPLE = 5;

export const robotsSitemapCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: () => true,

  async collect(context) {
    const findings: AuditFindingInput[] = [];
    const origin = new URL(context.url.normalizedUrl).origin;

    let robotsText: string | null = null;
    let robotsStatus: number | null = null;

    try {
      const robotsResponse = await context.services.fetchPage(`${origin}/robots.txt`, {
        timeoutMs: 10_000,
      });
      robotsStatus = robotsResponse.status;
      if (robotsResponse.status >= 200 && robotsResponse.status < 300) {
        robotsText = robotsResponse.bodyText;
      }
    } catch {
      robotsText = null;
    }

    if (!robotsText) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.robots_txt.missing",
          severity: "medium",
          status: "warning",
          title: "robots.txt not found",
          summary: "No accessible robots.txt file was found at the site root.",
          evidenceJson: { status: robotsStatus },
        }),
      );
    } else {
      const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(
        robotsText,
      );
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.robots_txt.present",
          severity: "info",
          status: "pass",
          title: "robots.txt found",
          summary: "A robots.txt file is available at the site root.",
          evidenceJson: { bytes: robotsText.length },
        }),
      );

      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.robots_txt.homepage_blocked",
          severity: blocksAll ? "critical" : "info",
          status: blocksAll ? "fail" : "pass",
          title: blocksAll
            ? "robots.txt may block all crawlers"
            : "Homepage does not appear fully blocked",
          summary: blocksAll
            ? "robots.txt contains a broad disallow rule for all user agents."
            : "No broad homepage crawl block was detected in robots.txt.",
        }),
      );
    }

    const declaredSitemaps = robotsText
      ? [...robotsText.matchAll(/^sitemap:\s*(.+)$/gim)].map((match) => match[1].trim())
      : [];

    const candidateSitemaps = [
      ...declaredSitemaps,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
    ];
    const uniqueCandidates = [...new Set(candidateSitemaps)].slice(0, 3);

    let sitemapUrl: string | null = null;
    let sitemapBody: string | null = null;

    for (const candidate of uniqueCandidates) {
      try {
        const response = await context.services.fetchPage(candidate, {
          timeoutMs: 10_000,
        });
        if (
          response.status >= 200 &&
          response.status < 300 &&
          (response.bodyText.includes("<urlset") ||
            response.bodyText.includes("<sitemapindex"))
        ) {
          sitemapUrl = candidate;
          sitemapBody = response.bodyText;
          break;
        }
      } catch {
        // Try next candidate.
      }
    }

    if (!sitemapBody) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.sitemap.missing",
          severity: "medium",
          status: "warning",
          title: "XML sitemap not found",
          summary: "No accessible XML sitemap was discovered.",
          evidenceJson: { checked: uniqueCandidates },
        }),
      );
    } else {
      const urlCount = (sitemapBody.match(/<loc>/gi) ?? []).length;
      const sampleUrls = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/gi)]
        .map((match) => match[1].trim())
        .slice(0, MAX_SITEMAP_URLS_TO_SAMPLE);

      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.sitemap.present",
          severity: "info",
          status: "pass",
          title: "XML sitemap found",
          summary: `Sitemap discovered at ${sitemapUrl}.`,
          evidenceJson: { sitemapUrl, urlCount, sampleUrls },
        }),
      );
    }

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        robotsFound: Boolean(robotsText),
        sitemapUrl,
      },
    };
  },
};
