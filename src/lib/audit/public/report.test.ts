import { describe, expect, it } from "vitest";
import { localSearchInterpretation, searchDemandRecommendation, searchVisibilityFailureMessage } from "./report";
import type { PublicAuditDetail } from "./types";

const result = (overrides: Record<string, unknown> = {}) => ({
  query: "financial advisor Indianapolis Indiana",
  type: "discovery" as const,
  service: null,
  position: null,
  found: false,
  rankingUrl: null,
  checkedAt: "2026-08-12T00:00:00.000Z",
  searchEngine: "google" as const,
  monthlySearchVolume: 590,
  demandLevel: "high" as const,
  location: "Indianapolis, Indiana, United States",
  resolvedLocationName: "Indianapolis, Indiana, United States",
  ...overrides,
});

describe("search-demand recommendation copy", () => {
  it("connects a high-demand missing ranking to the selected market", () => {
    const copy = searchDemandRecommendation(
      { category: "seo", title: "Help Google understand your business", description: "Improve service signals." },
      [result()],
    );

    expect(copy?.customerTitle).toBe("Improve visibility for high-demand services");
    expect(copy?.customerDescription).toContain("~590 monthly searches around Indianapolis, Indiana");
    expect(copy?.customerDescription).not.toContain("Indianapolis, United States");
  });

  it("connects an existing meaningful ranking to demand", () => {
    const copy = searchDemandRecommendation(
      { category: "seo", title: "Help Google understand your business", description: "Improve service signals." },
      [result({ position: 18, query: "wealth management Indianapolis Indiana", monthlySearchVolume: 110 })],
    );

    expect(copy?.customerTitle).toBe("Strengthen an existing search position");
    expect(copy?.customerDescription).toContain("rank #18");
    expect(copy?.customerDescription).toContain("~110 monthly searches around Indianapolis, Indiana");
  });

  it("promotes measurable primary-service demand even below high-demand thresholds", () => {
    const copy = searchDemandRecommendation(
      { category: "seo", title: "Help Google understand your business", description: "Improve service signals." },
      [result({ query: "basketball training Indianapolis Indiana", monthlySearchVolume: 30, demandLevel: "low", relevanceTier: 1, relevanceSource: "primary_service" })],
    );

    expect(copy?.customerTitle).toBe("Improve visibility for customer searches");
    expect(copy?.customerDescription).toContain("measurable local search demand");
    expect(copy?.customerDescription).toContain("~30 monthly searches");
  });

  it("falls back when demand is unavailable and does not invent volume", () => {
    const copy = searchDemandRecommendation(
      { category: "seo", title: "Help Google understand your business", description: "Improve service signals." },
      [result({ monthlySearchVolume: null, demandLevel: "unavailable" })],
    );

    expect(copy).toBeNull();
  });

  it("does not add evidence copy to unrelated recommendations", () => {
    const copy = searchDemandRecommendation(
      { category: "performance", title: "Improve mobile loading speed", description: "Improve LCP." },
      [result()],
    );

    expect(copy).toBeNull();
  });
});

describe("local search interpretation", () => {
  it("explains visibility without prominence", () => {
    expect(localSearchInterpretation({ foundCount: 4, queriesAnalyzed: 5, topThreeCount: 0 })).toContain("not yet prominently");
  });

  it("handles no local visibility", () => {
    expect(localSearchInterpretation({ foundCount: 0, queriesAnalyzed: 5, topThreeCount: 0 })).toContain("was not found");
  });

  it("recognizes strong visibility from repeated top-three results", () => {
    expect(localSearchInterpretation({ foundCount: 5, queriesAnalyzed: 5, topThreeCount: 3 })).toContain("strong local visibility");
  });
});

describe("search visibility failure messaging", () => {
  const visibility = (failureCode: string | null) => ({
    diagnostics: {
      failurePhase: failureCode ? "runtime" : null,
      failureCode,
      failureMessage: null,
      successfulQueryCount: 0,
      failedQueryCount: 0,
    },
  } as unknown as NonNullable<PublicAuditDetail["searchVisibility"]>);

  it("uses the insufficient-coverage copy only for insufficient coverage", () => {
    expect(searchVisibilityFailureMessage(visibility("insufficient_discovery_coverage"))).toContain("couldn't identify enough reliable customer search queries");
  });

  it("uses neutral copy for timeout and runtime failures", () => {
    expect(searchVisibilityFailureMessage(visibility("serp_location_resolution_timeout"))).toBe("Search Visibility could not be measured during this report.");
    expect(searchVisibilityFailureMessage(visibility("search_visibility_persistence_failed"))).toBe("Search Visibility could not be measured during this report.");
  });

  it("uses the same diagnostic-aware message for printable and interactive report callers", () => {
    expect(searchVisibilityFailureMessage(visibility("insufficient_discovery_coverage"))).toBe("We couldn't identify enough reliable customer search queries from the website to measure Google Search Visibility for this report.");
    expect(searchVisibilityFailureMessage(visibility("serp_location_resolution_timeout"))).toBe("Search Visibility could not be measured during this report.");
  });
});
