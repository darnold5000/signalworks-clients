import {
  formatConfidenceLabel,
  formatCoverageShort,
  getScoreConfidence,
  HEALTH_CHECK_PRODUCT_NAME,
} from "@/lib/audit/presentation/health-score";
import { formatScoreCoverageLabel } from "@/lib/audit/history/compare";
import {
  groupRecommendationsForReport,
  recommendationCategoryLabel,
} from "@/lib/audit/presentation/recommendation-groups";
import type { PublicAuditDetail } from "@/lib/audit/public/types";
import { wrapSowForPrintDocument } from "@/lib/legal/sow-print";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const grouped = groupRecommendationsForReport(detail.recommendations);

  const body = `
    <article>
      <header style="margin-bottom: 2rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #666;">Signal Works ${escapeHtml(HEALTH_CHECK_PRODUCT_NAME)}</p>
        <h1 style="margin: 0.25rem 0 0; font-size: 28px;">${escapeHtml(detail.businessName ?? detail.normalizedDomain)}</h1>
        <p style="color: #555; margin-top: 0.5rem;">${escapeHtml(detail.normalizedUrl)}</p>
      </header>

      <section style="margin-bottom: 1.5rem;">
        <h2>Executive summary</h2>
        <p>${escapeHtml(detail.summary ?? "No summary available.")}</p>
        <p style="font-size: 24px; font-weight: 700;">Website Health Score: ${detail.overallScore ?? "—"} / 100</p>
        ${coverage ? `<p><strong>Coverage:</strong> ${escapeHtml(formatCoverageShort(scoredCount!, eligibleCount!))}</p>` : ""}
        ${confidence ? `<p><strong>Confidence:</strong> ${escapeHtml(confidence)}</p>` : ""}
        ${coverage ? `<p>${escapeHtml(coverage)}</p>` : ""}
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Category scores</h2>
        <ul>
          ${detail.scores
            .map(
              (row) =>
                `<li>${escapeHtml(row.category)}: ${row.score} (weight ${row.weight})</li>`,
            )
            .join("")}
        </ul>
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Recommendations</h2>
        ${
          grouped.quickWins.length
            ? `<h3>Quick wins</h3><ul>${grouped.quickWins
                .map((rec) => `<li>${escapeHtml(rec.title)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${grouped.categoryGroups
          .map(
            (group) => `
          <h3>${escapeHtml(group.label)}</h3>
          <ul>${group.items.map((rec) => `<li>${escapeHtml(rec.title)}</li>`).join("")}</ul>`,
          )
          .join("")}
      </section>

      <section>
        <h2>Limitations</h2>
        <ul>
          <li>This is not a penetration test or accessibility certification.</li>
          <li>Unavailable categories are excluded from the overall score.</li>
        </ul>
      </section>
    </article>
  `;

  return wrapSowForPrintDocument(
    body,
    `Website Health Score — ${detail.businessName ?? detail.normalizedDomain}`,
  );
}
