import { wrapSowForPrintDocument } from "@/lib/legal/sow-print";
import { formatScoreCoverageLabel } from "@/lib/audit/history/compare";
import type { AuditRunDetail } from "@/lib/audit/admin/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAuditReportHtml(detail: AuditRunDetail): string {
  const scoring = detail.progress.scoring;
  const coverage =
    scoring?.eligibleCategoryCount && scoring?.scoredCategoryCount != null
      ? formatScoreCoverageLabel(
          scoring.scoredCategoryCount,
          scoring.eligibleCategoryCount,
        )
      : null;

  const strengths = scoring?.strengths ?? [];
  const opportunities = scoring?.opportunities ?? [];
  const recommendations = detail.recommendations;

  const body = `
    <article>
      <header style="margin-bottom: 2rem;">
        <p style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #666;">Signal Works Website Audit</p>
        <h1 style="margin: 0.25rem 0 0; font-size: 28px;">${escapeHtml(detail.businessName ?? detail.normalizedDomain)}</h1>
        ${detail.businessTypeHint ? `<p style="margin: 8px 0 0; color: #555;">Business type provided: ${escapeHtml(detail.businessTypeHint)}</p>` : ""}
        <p style="color: #555; margin-top: 0.5rem;">${escapeHtml(detail.normalizedUrl)}</p>
        <p style="color: #555;">Audit date: ${escapeHtml(detail.completedAt ?? detail.createdAt)}</p>
      </header>

      <section style="margin-bottom: 1.5rem;">
        <h2>Executive summary</h2>
        <p>${escapeHtml(detail.summary ?? "No summary available.")}</p>
        ${coverage ? `<p><strong>${escapeHtml(coverage)}</strong></p>` : ""}
        ${
          scoring?.unavailableCategories?.length
            ? `<p>Unavailable categories: ${escapeHtml(scoring.unavailableCategories.join(", "))}</p>`
            : ""
        }
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Overall and category scores</h2>
        <p style="font-size: 24px; font-weight: 700;">${detail.overallScore ?? "—"} / 100</p>
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
        <h2>Strengths</h2>
        <ul>${strengths.map((item) => `<li>${escapeHtml(item.title)}</li>`).join("") || "<li>None listed.</li>"}</ul>
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Priority opportunities</h2>
        <ul>${opportunities.map((item) => `<li>${escapeHtml(item.title)}</li>`).join("") || "<li>None listed.</li>"}</ul>
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Recommendations</h2>
        ${recommendations
          .map(
            (rec) => `
          <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0 0 0.25rem;">${escapeHtml(rec.title)}</h3>
            <p style="margin: 0.25rem 0; color: #666;">Priority: ${escapeHtml(rec.priority)} · Effort: ${escapeHtml(rec.effort ?? "—")}</p>
            <p>${escapeHtml(rec.description)}</p>
            <p style="font-size: 12px; color: #666;">Impact: ${escapeHtml(rec.impact ?? "—")}</p>
          </div>`,
          )
          .join("")}
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Methodology</h2>
        <p>Automated collectors analyze HTTP health, metadata, robots/sitemap, structured data, homepage content, and optional third-party performance data.</p>
        <p>Scoring version: ${escapeHtml(scoring?.scoringVersion ?? "—")} · Weight set: ${escapeHtml(scoring?.weightSetVersion ?? "—")}</p>
      </section>

      <section style="margin-bottom: 1.5rem;">
        <h2>Data sources</h2>
        <ul>
          <li>Automated website checks</li>
          <li>Signal Works Operations Inventory (client audits only)</li>
          <li>Google PageSpeed Insights lab data when configured</li>
        </ul>
      </section>

      <section>
        <h2>Limitations</h2>
        <ul>
          <li>This is not a penetration test or accessibility certification.</li>
          <li>Unavailable categories are excluded from the overall score.</li>
          <li>Estimated third-party metrics are labeled separately from verified data.</li>
          <li>No exact Google rankings are claimed without a verified source.</li>
        </ul>
      </section>
    </article>
  `;

  return wrapSowForPrintDocument(
    body,
    `Audit Report — ${detail.businessName ?? detail.normalizedDomain}`,
  );
}
