import { describe, expect, it } from "vitest";
import { generateSearchQueries } from "@/lib/audit/search-visibility/query-generation";
import { scoreSearchVisibility } from "@/lib/audit/search-visibility/scoring";
import { domainMatches } from "@/lib/audit/search-visibility/run";

describe("search visibility phase 1", () => {
  it("generates distinct branded and discovery queries", () => {
    const queries = generateSearchQueries({ businessName: "Refined Indiana", city: "Plainfield", state: "IN", services: ["Personal Training", "Personal Training", "Our Services"] });
    expect(queries.filter((query) => query.type === "branded")).toHaveLength(2);
    expect(queries.filter((query) => query.type === "discovery")).toHaveLength(1);
    expect(new Set(queries.map((query) => query.query.toLowerCase())).size).toBe(queries.length);
  });

  it("matches the audited domain without substring false positives", () => {
    expect(domainMatches("https://www.refined-indiana.org/services/training", "refined-indiana.org")).toBe(true);
    expect(domainMatches("https://refined-indiana.org.evil.example/services", "refined-indiana.org")).toBe(false);
  });

  it("weights discovery visibility more heavily than branded visibility", () => {
    const summary = scoreSearchVisibility([
      { query: "Refined Indiana", type: "branded", service: null, position: 1, found: true, rankingUrl: "https://refined-indiana.org", checkedAt: "now", searchEngine: "google", location: "Plainfield, IN" },
      { query: "personal training Plainfield IN", type: "discovery", service: "Personal Training", position: null, found: false, rankingUrl: null, checkedAt: "now", searchEngine: "google", location: "Plainfield, IN" },
    ]);
    expect(summary.score).toBe(15);
    expect(summary.notFoundCount).toBe(1);
  });
});
