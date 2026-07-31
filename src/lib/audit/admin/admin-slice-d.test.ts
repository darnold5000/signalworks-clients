import { describe, expect, it } from "vitest";
import { AUDIT_SCOPE_VERSIONS } from "@/lib/audit/constants";
import {
  adminRunAuditSchema,
  recommendationStatusSchema,
  toAuditType,
} from "@/lib/audit/admin/validation";
import {
  AUDIT_RUN_PERMISSIONS,
  AUDIT_VIEW_PERMISSIONS,
} from "@/lib/admin/require-admin-api-auth";
import { compareAuditHistory, formatScoreCoverageLabel } from "@/lib/audit/history/compare";
import { buildAuditReportHtml } from "@/lib/audit/reports/html-report";
import { createDefaultCollectors } from "@/lib/audit/collectors";
import { generateRecommendations } from "@/lib/audit/recommendations/generate";
import { pestsolutionsIndyFixtureFindings } from "@/lib/audit/scoring/fixtures";
import { scoreAuditFindings } from "@/lib/audit/scoring/score-audit";
import {
  countFailedCollectors,
  createInitialProgress,
  resolveRunStatus,
  withCollectorFinished,
} from "@/lib/audit/runner/progress";
import { PERMISSIONS } from "@/lib/permissions";
import type { AuditRunDetail } from "@/lib/audit/admin/types";
import type { AuditScope } from "@/lib/audit/types";

const publicScope: AuditScope = {
  auditType: "public",
  scopeVersion: AUDIT_SCOPE_VERSIONS.public,
  includeOperationsInventory: false,
  includeEmailAuth: false,
  isPublicReport: true,
};

const clientScope: AuditScope = {
  auditType: "client_health",
  scopeVersion: AUDIT_SCOPE_VERSIONS.client_health,
  includeOperationsInventory: true,
  includeEmailAuth: true,
  isPublicReport: false,
};

describe("adminRunAuditSchema", () => {
  it("accepts website audits without a tenant", () => {
    const parsed = adminRunAuditSchema.safeParse({
      rawUrl: "https://example.com",
      scopeChoice: "website",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires tenant for client health audits", () => {
    const parsed = adminRunAuditSchema.safeParse({
      rawUrl: "https://example.com",
      scopeChoice: "client_health",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts null optional fields from the admin form", () => {
    const parsed = adminRunAuditSchema.safeParse({
      rawUrl: "https://example.com",
      scopeChoice: "website",
      tenantId: null,
      businessName: null,
      internalNotes: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("maps scope choice to audit type", () => {
    expect(toAuditType("website")).toBe("public");
    expect(toAuditType("client_health")).toBe("client_health");
  });
});

describe("audit admin permissions", () => {
  it("includes view and run audit permissions for API routes", () => {
    expect(AUDIT_VIEW_PERMISSIONS).toContain(PERMISSIONS.viewAudits);
    expect(AUDIT_RUN_PERMISSIONS).toContain(PERMISSIONS.runAudits);
    expect(AUDIT_VIEW_PERMISSIONS).toContain(PERMISSIONS.manageTenants);
  });
});

describe("recommendationStatusSchema", () => {
  it("accepts workflow statuses", () => {
    for (const status of [
      "recommended",
      "planned",
      "in_progress",
      "completed",
      "dismissed",
      "client_action_required",
    ]) {
      expect(recommendationStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});

describe("compareAuditHistory", () => {
  it("diffs findings by stable check_key", () => {
    const history = compareAuditHistory({
      currentFindings: [
        { checkKey: "seo.title.present", status: "pass" },
        { checkKey: "seo.meta_description.missing", status: "fail" },
        { checkKey: "content.homepage.thin_content", status: "warning" },
      ],
      previousFindings: [
        { checkKey: "seo.title.present", status: "pass" },
        { checkKey: "seo.meta_description.missing", status: "pass" },
        { checkKey: "technical.redirect.chain", status: "warning" },
      ],
      currentScores: [{ category: "seo", score: 70 }],
      previousScores: [{ category: "seo", score: 90 }],
      currentOverall: 75,
      previousOverall: 85,
      previousRunId: "prev-run",
      previousCompletedAt: "2026-01-01T00:00:00Z",
    });

    expect(history.newFindings).toEqual(["content.homepage.thin_content", "seo.meta_description.missing"]);
    expect(history.resolvedFindings).toEqual(["technical.redirect.chain"]);
    expect(history.recurringFindings).toEqual([]);
    expect(history.overallScoreChange).toBe(-10);
    expect(history.categoryChanges[0]?.change).toBe(-20);
  });
});

describe("formatScoreCoverageLabel", () => {
  it("explains partial category coverage for Pest Solutions fixture", () => {
    const scoring = scoreAuditFindings(pestsolutionsIndyFixtureFindings(), publicScope);
    const label = formatScoreCoverageLabel(
      scoring.scoredCategoryCount,
      scoring.eligibleCategoryCount,
    );
    expect(label).toMatch(/Score based on \d+ of \d+ available categories/);
    expect(scoring.eligibleCategoryCount).toBeGreaterThan(scoring.scoredCategoryCount);
  });
});

describe("redirect chain recommendation rule", () => {
  it("creates recommendation with structural supporting keys only", () => {
    const result = generateRecommendations(
      [
        {
          category: "technical",
          checkKey: "technical.redirect.chain",
          severity: "low",
          status: "warning",
          title: "Redirect chain",
          summary: "warning",
          sourceType: "automated",
          sourceLabel: "HTTP hosting",
        },
      ],
      clientScope,
    );

    const rec = result.recommendations.find(
      (item) => item.recommendationKey === "technical.review_redirect_chain",
    );
    expect(rec).toBeDefined();
    expect(rec?.supportingFindingKeys).toEqual(["technical.redirect.chain"]);
    expect(rec?.description).not.toContain("technical.redirect.chain");
  });
});

describe("client health collector scope", () => {
  it("enables operations inventory only for client health scope", () => {
    const collectors = createDefaultCollectors();
    const ops = collectors.find((collector) => collector.key === "operations_inventory");
    expect(ops?.supports(publicScope)).toBe(false);
    expect(ops?.supports(clientScope)).toBe(true);
  });
});

describe("partially succeeded audits", () => {
  it("marks runs with collector failures as partially succeeded", () => {
    let progress = createInitialProgress(["http_hosting", "metadata", "pagespeed"]);
    progress = withCollectorFinished(progress, "http_hosting", { status: "succeeded" });
    progress = withCollectorFinished(progress, "metadata", { status: "failed", errorCode: "timeout" });
    progress = withCollectorFinished(progress, "pagespeed", { status: "succeeded" });

    expect(countFailedCollectors(progress)).toEqual(["metadata"]);
    expect(resolveRunStatus(progress, false)).toBe("partially_succeeded");
  });
});

describe("buildAuditReportHtml", () => {
  it("renders executive summary and coverage without storing HTML", () => {
    const scoring = scoreAuditFindings(pestsolutionsIndyFixtureFindings(), publicScope);
    const detail: AuditRunDetail = {
      runId: "run-1",
      requestId: "req-1",
      auditType: "public",
      businessName: "Pest Solutions Indy",
      normalizedDomain: "pestsolutionsindy.com",
      normalizedUrl: "https://pestsolutionsindy.com",
      tenantId: null,
      tenantName: null,
      internalNotes: "Staff note",
      status: "completed",
      overallScore: scoring.overallScore,
      summary: "Test summary",
      engineVersion: "1.0.0",
      scopeVersion: AUDIT_SCOPE_VERSIONS.public,
      createdAt: "2026-07-31T12:00:00Z",
      completedAt: "2026-07-31T12:05:00Z",
      progress: {
        phase: "complete",
        collectors: { http_hosting: { status: "succeeded" } },
        updatedAt: "2026-07-31T12:05:00Z",
        scoring: {
          scoringVersion: scoring.scoringVersion,
          weightSetVersion: scoring.weightSetVersion,
          eligibleCategoryCount: scoring.eligibleCategoryCount,
          scoredCategoryCount: scoring.scoredCategoryCount,
          unavailableCategories: scoring.unavailableCategories,
          strengths: scoring.strengths,
          opportunities: scoring.opportunities,
        },
      },
      findings: [],
      scores: scoring.categoryScores.map((row) => ({
        category: row.category,
        score: row.score,
        weight: row.weight,
        findingCount: row.findingCount,
      })),
      recommendations: [],
      history: null,
    };

    const html = buildAuditReportHtml(detail);
    expect(html).toContain("Executive summary");
    expect(html).toContain("Pest Solutions Indy");
    expect(html).toContain(
      formatScoreCoverageLabel(scoring.scoredCategoryCount, scoring.eligibleCategoryCount),
    );
    expect(html).not.toContain("Staff note");
  });
});
