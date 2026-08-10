import {
  formatConfidenceLabel,
  formatCoverageShort,
  getScoreConfidence,
} from "@/lib/audit/presentation/health-score";
import { formatScoreCoverageLabel } from "@/lib/audit/history/compare";
import type { PublicAuditDetail } from "@/lib/audit/public/types";
import { wrapSowForPrintDocument } from "@/lib/legal/sow-print";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility",
  aeo: "AI Search Readiness",
  conversion: "Customer Conversion",
  performance: "Speed & Performance",
  security: "Security",
  seo: "SEO Setup",
  technical: "Website Technology",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category.toLowerCase()] ?? category;
}

function statusForScore(score: number | null) {
  if (score == null) return "Not measured yet";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs improvement";
  return "Poor";
}

function plainSummary(detail: PublicAuditDetail) {
  const sorted = [...detail.scores].sort((a, b) => a.score - b.score);
  const weakest = sorted[0] ? categoryLabel(sorted[0].category).toLowerCase() : "your website";
  const strongest = sorted.at(-1) ? categoryLabel(sorted.at(-1)!.category).toLowerCase() : "your website";
  return `Your website has a strong foundation, especially in ${strongest}. The biggest opportunity is improving ${weakest} so visitors and search engines can understand and use your business more easily.`;
}

export function buildPublicAuditReportHtml(detail: PublicAuditDetail): string {
  const scoring = detail.progress.scoring;
  const scoredCount = scoring?.scoredCategoryCount;
  const eligibleCount = scoring?.eligibleCategoryCount;
  const coverage =
    scoredCount != null && eligibleCount != null
      ? formatScoreCoverageLabel(scoredCount, eligibleCount)
      : null;
  const confidence =
    scoredCount != null ? formatConfidenceLabel(getScoreConfidence(scoredCount)) : null;
  const body = `
    <article style="max-width: 820px; margin: 0 auto; font-family: Arial, sans-serif; color: #121212;">
      <header style="margin-bottom: 3rem; border-bottom: 1px solid #e2e0da; padding-bottom: 2rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Website visibility report</p>
        <h1 style="margin: 0.5rem 0 0; font-size: 42px; font-weight: 500;">${escapeHtml(detail.businessName ?? detail.normalizedDomain)}</h1>
        <p style="color: #666; margin-top: 0.75rem;">${escapeHtml(detail.normalizedUrl)}</p>
        <p style="color: #666; margin-top: 1rem; line-height: 1.6;">We analyzed your website, search readiness, performance, and customer experience to identify what&apos;s working and where you have opportunities to improve.</p>
      </header>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Executive summary</p>
        <h2 style="font-size: 28px; font-weight: 500;">Is your website healthy?</h2>
        <div style="background: #121212; color: white; border-radius: 12px; padding: 2rem; margin-top: 1rem;">
          <p style="text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: #aaa;">Website health</p>
          <p style="font-size: 64px; line-height: 1; margin: 1.5rem 0 0.75rem;">${detail.overallScore == null ? "—" : Math.round(detail.overallScore)} <span style="font-size: 14px; color: #aaa;">/ 100</span></p>
          <p style="font-weight: 600;">${statusForScore(detail.overallScore)}</p>
          <p style="color: #ccc; line-height: 1.6;">${escapeHtml(detail.summary ?? "Your website has a strong foundation, with several opportunities to improve performance and search visibility.")}</p>
        </div>
        <p style="font-size: 18px; line-height: 1.7; margin-top: 2rem;"><strong>What this means:</strong> ${escapeHtml(plainSummary(detail))}</p>
      </section>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Your website health</p>
        <h2 style="font-size: 28px; font-weight: 500;">Built for visitors, search engines, and AI</h2>
        <div style="display: grid; gap: 12px;">
          ${detail.scores.map((row) => `<div style="border: 1px solid #e2e0da; border-radius: 10px; padding: 1rem 1.25rem;"><div style="display: flex; justify-content: space-between; gap: 1rem;"><div><strong>${escapeHtml(categoryLabel(row.category))}</strong></div><div style="text-align: right;"><strong style="font-size: 24px;">${Math.round(row.score)}</strong><p style="margin: 0.25rem 0 0; font-size: 12px; color: #666;">${statusForScore(row.score)}</p></div></div><div style="height: 6px; background: #f1f0ec; border-radius: 6px; margin-top: 1rem;"><div style="height: 6px; width: ${Math.max(0, Math.min(100, row.score))}%; background: #121212; border-radius: 6px;"></div></div></div>`).join("")}
        </div>
      </section>

      <section style="margin-bottom: 3rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Your biggest opportunities</p>
        <h2 style="font-size: 28px; font-weight: 500;">Improvements worth prioritizing</h2>
        ${detail.recommendations.slice(0, 5).map((rec, index) => `<div style="border-bottom: 1px solid #e2e0da; padding: 1rem 0;"><div style="display: flex; gap: 1rem;"><strong style="font-size: 22px; color: #666;">${index + 1}</strong><div><strong>${escapeHtml(rec.title)}</strong><p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(rec.priority)} priority · ${escapeHtml(rec.impact ?? "Impact varies")} · ${escapeHtml(rec.effort ?? "Review effort")}</p><p style="color: #555; line-height: 1.6;">${escapeHtml(rec.description)}</p><p style="font-size: 12px; color: #666;">Category: ${escapeHtml(categoryLabel(rec.category))}</p></div></div></div>`).join("") || `<p style="color: #666;">No recommendations were recorded for this report.</p>`}
      </section>

      <section style="margin-bottom: 3rem; border: 1px solid #e2e0da; border-radius: 12px; padding: 1.5rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #666;">Search visibility</p>
        <h2 style="font-size: 24px; font-weight: 500;">Can customers find your business?</h2>
        <p style="color: #555; line-height: 1.6;">Ranking data is not measured in this report yet. SEO Setup checks show whether your website is prepared for search, but we do not claim Google rankings without verified search data.</p>
      </section>

      <section style="font-size: 13px; color: #666;"><p><strong>Report details:</strong> Last checked ${escapeHtml(detail.completedAt ?? detail.createdAt)}${coverage ? ` · ${escapeHtml(formatCoverageShort(scoredCount!, eligibleCount!))}` : ""}${confidence ? ` · Confidence: ${escapeHtml(confidence)}` : ""}</p><p>This is not a penetration test or accessibility certification. Unavailable categories are excluded from the overall score.</p></section>
    </article>
  `;

  return wrapSowForPrintDocument(
    body,
    `Website Health Score — ${detail.businessName ?? detail.normalizedDomain}`,
  );
}
