import { describe, expect, it } from "vitest";
import { AUDIT_SCOPE_VERSIONS } from "@/lib/audit/constants";
import {
  filterRecommendationsForAudience,
  generateRecommendations,
} from "@/lib/audit/recommendations/generate";
import { RECOMMENDATION_RULES } from "@/lib/audit/recommendations/catalog";
import {
  allPassFixtureFindings,
  pestsolutionsIndyFixtureFindings,
} from "@/lib/audit/scoring/fixtures";
import { clampScore, pointsForFindingStatus } from "@/lib/audit/scoring/impacts";
import { scoreAuditFindings } from "@/lib/audit/scoring/score-audit";
import {
  CLIENT_HEALTH_CATEGORY_WEIGHTS,
  PUBLIC_CATEGORY_WEIGHTS,
  getWeightSetForScope,
} from "@/lib/audit/scoring/weights";
import type { AuditFindingInput, AuditScope } from "@/lib/audit/types";

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

function finding(
  partial: Omit<AuditFindingInput, "sourceType" | "sourceLabel">,
): AuditFindingInput {
  return {
    sourceType: "automated",
    sourceLabel: "Automated website check",
    ...partial,
  };
}

describe("scoreAuditFindings", () => {
  it("scores an all-pass audit near 100", () => {
    const result = scoreAuditFindings(allPassFixtureFindings(), publicScope);
    expect(result.overallScore).toBeGreaterThanOrEqual(95);
    expect(result.unavailableCategories).toContain("performance");
  });

  it("handles mixed pass, warning, and fail deterministically", () => {
    const findings = [
      finding({
        category: "seo",
        checkKey: "seo.title.present",
        severity: "info",
        status: "pass",
        title: "Title ok",
        summary: "pass",
      }),
      finding({
        category: "seo",
        checkKey: "seo.meta_description.missing",
        severity: "high",
        status: "fail",
        title: "Missing description",
        summary: "fail",
      }),
      finding({
        category: "technical",
        checkKey: "technical.redirect.chain",
        severity: "low",
        status: "warning",
        title: "Redirect chain",
        summary: "warning",
      }),
    ];

    const first = scoreAuditFindings(findings, publicScope);
    const second = scoreAuditFindings(findings, publicScope);
    expect(first).toEqual(second);
    expect(first.categoryScores.find((row) => row.category === "seo")?.score).toBe(50);
    expect(first.overallScore).toBeLessThan(100);
  });

  it("excludes unavailable PageSpeed from performance denominator", () => {
    const result = scoreAuditFindings(pestsolutionsIndyFixtureFindings(), publicScope);
    expect(result.unavailableCategories).toContain("performance");
    expect(result.overallScore).not.toBeNull();
    expect(result.categoryScores.some((row) => row.category === "performance")).toBe(false);
  });

  it("returns null overall score when no categories are scorable", () => {
    const result = scoreAuditFindings(
      [
        finding({
          category: "performance",
          checkKey: "performance.pagespeed.unconfigured",
          severity: "low",
          status: "unavailable",
          title: "Unavailable",
          summary: "Unavailable",
        }),
      ],
      publicScope,
    );
    expect(result.overallScore).toBeNull();
    expect(result.unavailableCategories.length).toBeGreaterThan(0);
  });

  it("clamps scores between 0 and 100", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-10)).toBe(0);
    expect(pointsForFindingStatus("unavailable")).toBeNull();
    expect(pointsForFindingStatus("manual_review")).toBeNull();
  });

  it("uses different weight sets for public vs client scope", () => {
    expect(getWeightSetForScope(publicScope).weights).toEqual(PUBLIC_CATEGORY_WEIGHTS);
    expect(getWeightSetForScope(clientScope).weights).toEqual(
      CLIENT_HEALTH_CATEGORY_WEIGHTS,
    );
  });

  it("produces stable strengths and opportunities ordering", () => {
    const result = scoreAuditFindings(pestsolutionsIndyFixtureFindings(), publicScope);
    expect(result.strengths[0]?.checkKey).toBe("seo.canonical.present");
    expect(result.opportunities[0]?.checkKey).toBe("content.homepage.thin_content");
  });
});

describe("generateRecommendations", () => {
  it("does not generate recommendations for passing findings", () => {
    const result = generateRecommendations(allPassFixtureFindings(), publicScope);
    expect(result.recommendations).toHaveLength(0);
  });

  it("maps missing meta description to a recommendation", () => {
    const result = generateRecommendations(
      [
        finding({
          category: "seo",
          checkKey: "seo.meta_description.missing",
          severity: "high",
          status: "fail",
          title: "Missing meta description",
          summary: "Missing",
        }),
      ],
      publicScope,
    );

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.recommendationKey).toBe("seo.add_meta_description");
    expect(result.recommendations[0]?.supportingFindingKeys).toEqual([
      "seo.meta_description.missing",
    ]);
  });

  it("maps multiple findings to one operations recommendation", () => {
    const result = generateRecommendations(
      [
        finding({
          category: "operations",
          checkKey: "operations.registrar.recorded",
          severity: "low",
          status: "manual_review",
          title: "Registrar not recorded",
          summary: "Missing",
        }),
        finding({
          category: "operations",
          checkKey: "operations.backups.unknown",
          severity: "medium",
          status: "manual_review",
          title: "Backups unknown",
          summary: "Missing",
        }),
      ],
      clientScope,
    );

    const rec = result.recommendations.find(
      (item) => item.recommendationKey === "operations.complete_inventory",
    );
    expect(rec?.supportingFindingKeys).toEqual([
      "operations.backups.unknown",
      "operations.registrar.recorded",
    ]);
  });

  it("filters public visibility for public scope", () => {
    const result = generateRecommendations(
      [
        finding({
          category: "security",
          checkKey: "security.headers.basic",
          severity: "medium",
          status: "warning",
          title: "Security headers",
          summary: "warning",
        }),
        finding({
          category: "seo",
          checkKey: "seo.meta_description.missing",
          severity: "high",
          status: "fail",
          title: "Missing description",
          summary: "fail",
        }),
      ],
      publicScope,
    );

    expect(result.recommendations.some((rec) => rec.isPublic)).toBe(true);
    expect(
      result.recommendations.every(
        (rec) => rec.recommendationKey !== "security.improve_security_headers",
      ),
    ).toBe(true);
  });

  it("keeps staff/client recommendations for client scope", () => {
    const result = generateRecommendations(
      [
        finding({
          category: "security",
          checkKey: "security.headers.basic",
          severity: "medium",
          status: "warning",
          title: "Security headers",
          summary: "warning",
        }),
      ],
      clientScope,
    );

    expect(
      result.recommendations.some(
        (rec) => rec.recommendationKey === "security.improve_security_headers",
      ),
    ).toBe(true);
  });

  it("maps service keys from the catalog", () => {
    const withService = RECOMMENDATION_RULES.find(
      (rule) => rule.recommendationKey === "seo.add_localbusiness_schema",
    );
    expect(withService?.signalworksServiceKey).toBe("local_seo");
  });

  it("sorts recommendations deterministically by priority then key", () => {
    const result = generateRecommendations(
      [
        finding({
          category: "content",
          checkKey: "content.homepage.thin_content",
          severity: "medium",
          status: "warning",
          title: "Thin content",
          summary: "warning",
        }),
        finding({
          category: "seo",
          checkKey: "seo.meta_description.missing",
          severity: "high",
          status: "fail",
          title: "Missing description",
          summary: "fail",
        }),
      ],
      publicScope,
    );

    expect(result.recommendations[0]?.priority).toBe("high");
    expect(result.recommendations.map((rec) => rec.recommendationKey)).toEqual([
      "seo.add_meta_description",
      "content.expand_homepage_copy",
    ]);
  });
});

describe("Pest Solutions Indy acceptance fixture", () => {
  it("produces explainable score output without live network", () => {
    const findings = pestsolutionsIndyFixtureFindings();
    const scoring = scoreAuditFindings(findings, publicScope);
    const recommendations = generateRecommendations(findings, publicScope);

    expect(scoring.overallScore).not.toBeNull();
    expect(scoring.unavailableCategories).toEqual(["accessibility", "aeo", "performance"]);
    expect(scoring.opportunities.some((item) => item.checkKey === "content.homepage.thin_content")).toBe(
      true,
    );
    expect(
      recommendations.recommendations.some(
        (rec) => rec.recommendationKey === "content.expand_homepage_copy",
      ),
    ).toBe(true);

    const publicRecommendations = filterRecommendationsForAudience(
      recommendations.recommendations,
      "public",
    );
    expect(publicRecommendations.every((rec) => rec.isPublic)).toBe(true);
  });
});
