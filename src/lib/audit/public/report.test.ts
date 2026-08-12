import { describe, expect, it } from "vitest";
import { localSearchInterpretation, searchDemandRecommendation } from "./report";

const result = (overrides: Record<string, unknown> = {}) => ({
  query: "financial advisor Indianapolis Indiana",
  type: "discovery" as const,
  position: null,
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
