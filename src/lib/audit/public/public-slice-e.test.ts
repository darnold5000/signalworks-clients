import { describe, expect, it } from "vitest";
import { pestsolutionsIndyFixtureFindings } from "@/lib/audit/scoring/fixtures";
import { generateRecommendations } from "@/lib/audit/recommendations/generate";
import { AUDIT_SCOPE_VERSIONS } from "@/lib/audit/constants";
import {
  filterFindingsForPublicAudience,
  filterRecommendationsForPublic,
  PUBLIC_SCORING_CATEGORIES,
} from "@/lib/audit/public/visibility";
import { publicRunAuditSchema } from "@/lib/audit/public/validation";
import { buildPublicAuditReportHtml } from "@/lib/audit/public/report";
import { checkPublicAuditRateLimit } from "@/lib/audit/public/rate-limit";
import type { AuditScope } from "@/lib/audit/types";

const publicScope: AuditScope = {
  auditType: "public",
  scopeVersion: AUDIT_SCOPE_VERSIONS.public,
  includeOperationsInventory: false,
  includeEmailAuth: false,
  isPublicReport: true,
};

describe("publicRunAuditSchema", () => {
  it("rejects honeypot submissions", () => {
    const parsed = publicRunAuditSchema.safeParse({
      rawUrl: "https://example.com",
      companyWebsite: "spam",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts minimal public submissions", () => {
    const parsed = publicRunAuditSchema.safeParse({
      rawUrl: "https://example.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an optional business type hint without requiring it", () => {
    const parsed = publicRunAuditSchema.safeParse({ rawUrl: "https://example.com", businessTypeHint: "Web design & software development" });
    expect(parsed.success).toBe(true);
    expect(publicRunAuditSchema.safeParse({ rawUrl: "https://example.com", businessTypeHint: "x".repeat(161) }).success).toBe(false);
  });
});

describe("filterFindingsForPublicAudience", () => {
  it("includes public scoring categories and excludes verified ops findings", () => {
    const filtered = filterFindingsForPublicAudience([
      {
        category: "seo",
        checkKey: "seo.title.present",
        severity: "info",
        status: "pass",
        title: "Title",
        summary: "ok",
        sourceLabel: "Automated",
        isPublic: false,
        sourceType: "automated",
      },
      {
        category: "operations",
        checkKey: "operations.registrar.recorded",
        severity: "low",
        status: "manual_review",
        title: "Registrar",
        summary: "missing",
        sourceLabel: "Ops",
        isPublic: false,
        sourceType: "verified",
      },
    ]);

    expect(filtered.map((row) => row.checkKey)).toEqual(["seo.title.present"]);
    expect(PUBLIC_SCORING_CATEGORIES).toContain("seo");
    expect(PUBLIC_SCORING_CATEGORIES).not.toContain("operations");
  });
});

describe("filterRecommendationsForPublic", () => {
  it("returns only public recommendations for fixture findings", () => {
    const generated = generateRecommendations(
      pestsolutionsIndyFixtureFindings(),
      publicScope,
    );
    const filtered = filterRecommendationsForPublic(generated.recommendations);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((rec) => rec.isPublic)).toBe(true);
  });
});

describe("buildPublicAuditReportHtml", () => {
  it("renders score coverage copy", () => {
    const html = buildPublicAuditReportHtml({
      token: "a".repeat(64),
      runId: "run",
      status: "completed",
      businessName: "Example Co",
      normalizedDomain: "example.com",
      normalizedUrl: "https://example.com",
      overallScore: 82,
      summary: "Summary",
      completedAt: "2026-07-31T00:00:00Z",
      createdAt: "2026-07-31T00:00:00Z",
      progress: {
        scoring: {
          eligibleCategoryCount: 10,
          scoredCategoryCount: 7,
        },
      },
      scores: [{ category: "seo", score: 80, weight: 20 }],
      findings: [],
      recommendations: [],
    });

    expect(html).toContain("Website Health Score");
    expect(html).toContain("7 of 10 categories measured");
    expect(html).not.toContain("Confidence");
    expect(html.indexOf("Customer Discovery")).toBeLessThan(html.indexOf("Website Readiness"));
    expect(html.indexOf("Google Search Visibility")).toBeLessThan(html.indexOf("Website Foundation"));
  });
});

describe("checkPublicAuditRateLimit", () => {
  it("allows first request and blocks after threshold", () => {
    const key = `test-${Date.now()}`;
    expect(checkPublicAuditRateLimit(key).ok).toBe(true);
    for (let i = 0; i < 4; i += 1) {
      expect(checkPublicAuditRateLimit(key).ok).toBe(true);
    }
    expect(checkPublicAuditRateLimit(key).ok).toBe(false);
  });
});
