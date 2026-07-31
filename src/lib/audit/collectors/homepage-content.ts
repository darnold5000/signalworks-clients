import { automatedFinding } from "@/lib/audit/collectors/shared/finding";
import {
  countImagesMissingAlt,
  extractLinks,
  visibleTextIncludes,
} from "@/lib/audit/collectors/shared/html-parse";
import type { AuditCollector, AuditFindingInput } from "@/lib/audit/types";

const COLLECTOR_KEY = "homepage_content";
const MAX_LINK_CHECKS = 8;

const CTA_PHRASES = [
  "contact us",
  "get a quote",
  "request a quote",
  "schedule",
  "book now",
  "call now",
  "free estimate",
  "get started",
];

const SERVICE_PHRASES = ["services", "our services", "what we do", "solutions"];

export const homepageContentCollector: AuditCollector = {
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
            category: "content",
            checkKey: "content.homepage.unavailable",
            severity: "medium",
            status: "unavailable",
            title: "Homepage content could not be analyzed",
            summary: "Homepage HTML was not available for content checks.",
          }),
        ],
        errorCode: "homepage_unavailable",
      };
    }

    const html = homepage.bodyText;
    const origin = new URL(homepage.finalUrl).origin;

    const hasPhone =
      /\(\d{3}\)\s*\d{3}-\d{4}/.test(html) ||
      /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(html);
    const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(html);

    findings.push(
      automatedFinding({
        category: "conversion",
        checkKey: "conversion.contact.visible",
        severity: hasPhone || hasEmail ? "info" : "medium",
        status: hasPhone || hasEmail ? "pass" : "warning",
        title:
          hasPhone || hasEmail
            ? "Contact information visible on homepage"
            : "Contact information not clearly visible",
        summary:
          hasPhone || hasEmail
            ? `Detected ${[hasPhone ? "phone" : null, hasEmail ? "email" : null].filter(Boolean).join(" and ")} on the homepage.`
            : "No obvious phone number or email address was detected on the homepage.",
        evidenceJson: { hasPhone, hasEmail },
      }),
    );

    const hasCta = visibleTextIncludes(html, CTA_PHRASES);
    findings.push(
      automatedFinding({
        category: "conversion",
        checkKey: "conversion.primary_cta.present",
        severity: hasCta ? "info" : "medium",
        status: hasCta ? "pass" : "warning",
        title: hasCta ? "Primary CTA language detected" : "Primary CTA language not detected",
        summary: hasCta
          ? "Homepage copy includes common call-to-action phrases."
          : "No common call-to-action phrases were detected in homepage copy.",
      }),
    );

    const hasServiceSignals = visibleTextIncludes(html, SERVICE_PHRASES);
    findings.push(
      automatedFinding({
        category: "content",
        checkKey: "content.services.discoverable",
        severity: hasServiceSignals ? "info" : "low",
        status: hasServiceSignals ? "pass" : "warning",
        title: hasServiceSignals
          ? "Service-related content detected"
          : "Service-related content not prominent",
        summary: hasServiceSignals
          ? "Homepage includes service-related language."
          : "Service-related language was not prominent on the homepage.",
      }),
    );

    const links = extractLinks(html);
    const privacyLink = links.find((link) => /privacy/i.test(link.href + link.text));
    const termsLink = links.find((link) => /terms/i.test(link.href + link.text));

    findings.push(
      automatedFinding({
        category: "content",
        checkKey: "content.privacy_link.present",
        severity: privacyLink ? "info" : "low",
        status: privacyLink ? "pass" : "warning",
        title: privacyLink ? "Privacy policy link found" : "Privacy policy link not found",
        summary: privacyLink
          ? "A privacy-related link was found on the homepage."
          : "No privacy policy link was detected on the homepage.",
      }),
      automatedFinding({
        category: "content",
        checkKey: "content.terms_link.present",
        severity: termsLink ? "info" : "low",
        status: termsLink ? "pass" : "warning",
        title: termsLink ? "Terms link found" : "Terms link not found",
        summary: termsLink
          ? "A terms-related link was found on the homepage."
          : "No terms link was detected on the homepage.",
      }),
    );

    const imageStats = countImagesMissingAlt(html);
    if (imageStats.total > 0) {
      findings.push(
        automatedFinding({
          category: "accessibility",
          checkKey: "accessibility.image_alt.coverage",
          severity: imageStats.missingAlt > 0 ? "medium" : "info",
          status: imageStats.missingAlt === 0 ? "pass" : "warning",
          title: "Homepage image alt text coverage",
          summary: `${imageStats.total - imageStats.missingAlt} of ${imageStats.total} images include alt text.`,
          evidenceJson: imageStats,
        }),
      );
    }

    const thinContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length < 400;
    findings.push(
      automatedFinding({
        category: "content",
        checkKey: "content.homepage.thin_content",
        severity: thinContent ? "medium" : "info",
        status: thinContent ? "warning" : "pass",
        title: thinContent ? "Homepage content appears thin" : "Homepage content length looks adequate",
        summary: thinContent
          ? "The visible homepage text content is relatively short."
          : "The homepage includes a reasonable amount of visible text content.",
      }),
    );

    const sameOriginLinks = links
      .map((link) => {
        try {
          return new URL(link.href, homepage.finalUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((href): href is string => {
        if (!href) return false;
        try {
          const parsed = new URL(href);
          return parsed.origin === origin && parsed.pathname !== "/";
        } catch {
          return false;
        }
      })
      .slice(0, MAX_LINK_CHECKS);

    const brokenLinks: string[] = [];
    for (const href of sameOriginLinks) {
      try {
        const response = await context.services.fetchPage(href, { timeoutMs: 8_000 });
        if (response.status >= 400) brokenLinks.push(href);
      } catch {
        brokenLinks.push(href);
      }
    }

    if (sameOriginLinks.length > 0) {
      findings.push(
        automatedFinding({
          category: "technical",
          checkKey: "technical.homepage_links.broken_sample",
          severity: brokenLinks.length > 0 ? "medium" : "info",
          status: brokenLinks.length > 0 ? "warning" : "pass",
          title:
            brokenLinks.length > 0
              ? `${brokenLinks.length} broken homepage links (sample)`
              : "No broken links in homepage sample",
          summary:
            brokenLinks.length > 0
              ? `Broken links detected in a sample of ${sameOriginLinks.length} homepage links.`
              : `Checked ${sameOriginLinks.length} homepage links; none returned error statuses.`,
          evidenceJson: { checked: sameOriginLinks.length, brokenLinks },
        }),
      );
    }

    return {
      collectorKey: COLLECTOR_KEY,
      findings,
      evidence: {
        linkCount: links.length,
        brokenLinkSampleCount: brokenLinks.length,
      },
    };
  },
};
