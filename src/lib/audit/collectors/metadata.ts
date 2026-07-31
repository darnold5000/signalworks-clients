import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import {
  extractCanonicalUrl,
  extractHeadings,
  extractHtmlLang,
  extractMetaContent,
  extractTitle,
} from "@/lib/audit/collectors/shared/html-parse";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "metadata";

export const metadataCollector: AuditCollector = {
  key: COLLECTOR_KEY,
  supports: () => true,

  async collect(context) {
    const findings: AuditFindingInput[] = [];
    const homepage = await context.services.getHomepage();

    if (!homepage) {
      return {
        collectorKey: COLLECTOR_KEY,
        findings: [
          automatedFinding({
            category: "seo",
            checkKey: "seo.metadata.unavailable",
            severity: "medium",
            status: "unavailable",
            title: "Metadata could not be analyzed",
            summary: "Homepage HTML was not available for metadata checks.",
          }),
        ],
        errorCode: "homepage_unavailable",
      };
    }

    const html = homepage.bodyText;
    const title = extractTitle(html);

    if (!title) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.title.missing",
          severity: "high",
          status: "fail",
          title: "Missing page title",
          summary: "No <title> element was found on the homepage.",
        }),
      );
    } else {
      const titleLength = title.length;
      let status: AuditFindingInput["status"] = "pass";
      let severity: AuditFindingInput["severity"] = "info";
      if (titleLength < 20) {
        status = "warning";
        severity = "medium";
      } else if (titleLength > 60) {
        status = "warning";
        severity = "low";
      }

      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.title.present",
          severity,
          status,
          title: "Page title present",
          summary: `Title: "${title}" (${titleLength} characters).`,
          evidenceJson: { title, length: titleLength },
        }),
      );
    }

    const description = extractMetaContent(html, "description");
    if (!description) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.meta_description.missing",
          severity: "high",
          status: "fail",
          title: "Missing meta description",
          summary: "No meta description was found on the homepage.",
        }),
      );
    } else {
      const length = description.length;
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.meta_description.present",
          severity: length < 70 || length > 160 ? "medium" : "info",
          status: length < 50 || length > 170 ? "warning" : "pass",
          title: "Meta description present",
          summary: `Meta description is ${length} characters.`,
          evidenceJson: { description, length },
        }),
      );
    }

    const canonical = extractCanonicalUrl(html);
    findings.push(
      automatedFinding({
        category: "seo",
        checkKey: canonical ? "seo.canonical.present" : "seo.canonical.missing",
        severity: canonical ? "info" : "medium",
        status: canonical ? "pass" : "warning",
        title: canonical ? "Canonical URL present" : "Canonical URL missing",
        summary: canonical
          ? `Canonical URL: ${canonical}`
          : "No canonical link element was found on the homepage.",
        evidenceJson: { canonical },
      }),
    );

    const robotsMeta = extractMetaContent(html, "robots");
    if (robotsMeta?.toLowerCase().includes("noindex")) {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.robots_meta.noindex",
          severity: "high",
          status: "warning",
          title: "Homepage has noindex directive",
          summary: `Robots meta tag: ${robotsMeta}`,
          evidenceJson: { robotsMeta },
        }),
      );
    } else {
      findings.push(
        automatedFinding({
          category: "seo",
          checkKey: "seo.robots_meta.indexable",
          severity: "info",
          status: "pass",
          title: "No noindex directive on homepage",
          summary: robotsMeta
            ? `Robots meta tag: ${robotsMeta}`
            : "No restrictive robots meta tag was detected.",
          evidenceJson: { robotsMeta },
        }),
      );
    }

    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    findings.push(
      automatedFinding({
        category: "seo",
        checkKey: "seo.open_graph.basic",
        severity: ogTitle && ogDescription ? "info" : "low",
        status: ogTitle && ogDescription ? "pass" : "warning",
        title: "Open Graph metadata",
        summary:
          ogTitle && ogDescription
            ? "Basic Open Graph title and description tags are present."
            : "Open Graph title and/or description tags are missing.",
        evidenceJson: { ogTitle, ogDescription },
      }),
    );

    const viewport = extractMetaContent(html, "viewport");
    findings.push(
      automatedFinding({
        category: "technical",
        checkKey: "seo.viewport.present",
        severity: viewport ? "info" : "high",
        status: viewport ? "pass" : "fail",
        title: viewport ? "Viewport meta tag present" : "Viewport meta tag missing",
        summary: viewport
          ? "A mobile viewport meta tag was found."
          : "No viewport meta tag was found.",
        evidenceJson: { viewport },
      }),
    );

    const lang = extractHtmlLang(html);
    findings.push(
      automatedFinding({
        category: "seo",
        checkKey: "seo.html.lang",
        severity: lang ? "info" : "low",
        status: lang ? "pass" : "warning",
        title: lang ? "HTML lang attribute present" : "HTML lang attribute missing",
        summary: lang ? `Document language: ${lang}` : "No lang attribute was found on <html>.",
        evidenceJson: { lang },
      }),
    );

    const h1s = extractHeadings(html, 1);
    findings.push(
      automatedFinding({
        category: "seo",
        checkKey: "seo.h1.count",
        severity: h1s.length === 1 ? "info" : "medium",
        status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warning",
        title: `H1 heading count: ${h1s.length}`,
        summary:
          h1s.length === 1
            ? `Single H1 found: "${h1s[0]}".`
            : h1s.length === 0
              ? "No H1 heading was found on the homepage."
              : "Multiple H1 headings were found on the homepage.",
        evidenceJson: { h1s },
      }),
    );

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: { title, description, canonical, h1Count: h1s.length },
    };
  },
};
