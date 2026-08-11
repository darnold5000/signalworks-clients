import { describe, expect, it } from "vitest";
import { generateSearchQueries } from "@/lib/audit/search-visibility/query-generation";
import { scoreSearchVisibility } from "@/lib/audit/search-visibility/scoring";
import { domainMatches } from "@/lib/audit/search-visibility/run";
import { matchUsLocation } from "@/lib/audit/search-visibility/client";

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
    expect(summary.score).toBe(0);
    expect(summary.discoveryScore).toBe(0);
    expect(summary.brandedScore).toBe(100);
    expect(summary.discoveryQueriesAnalyzed).toBe(1);
    expect(summary.brandedQueriesAnalyzed).toBe(1);
    expect(summary.queriesAnalyzed).toBe(2);
    expect(summary.notFoundCount).toBe(1);
  });

  it("rejects navigation, legal, and generic page names from discovery queries", () => {
    const queries = generateSearchQueries({
      businessName: "Market Street Wealth",
      city: "Indianapolis",
      state: "IN",
      services: [
        "Important Disclosure Information",
        "Foundations",
        "Our Fees",
        "Meet Our People",
        "Complimentary Initial Meetings",
        "Careers",
        "Wealth Management",
        "Business Retirement Plans",
      ],
    });
    expect(queries).toHaveLength(10);
    expect(queries.filter((query) => query.type === "branded")).toHaveLength(2);
    expect(queries.filter((query) => query.type === "discovery")).toHaveLength(8);
    expect(queries.filter((query) => query.type === "discovery").map((query) => query.query)).toEqual([
      "wealth management Indianapolis IN",
      "financial advisor Indianapolis IN",
      "financial planner Indianapolis IN",
      "retirement planning Indianapolis IN",
      "retirement advisor Indianapolis IN",
      "investment management Indianapolis IN",
      "business retirement plans Indianapolis IN",
      "wealth advisor Indianapolis IN",
    ]);
    expect(queries.some((query) => /disclosure|foundations|fees|people|meet|careers/i.test(query.query))).toBe(false);
  });

  it("resolves a state abbreviation to DataForSEO's canonical city location", () => {
    expect(matchUsLocation([
      { location_code: 1001, location_name: "Indianapolis,Indiana,United States", location_type: "City", country_iso_code: "US" },
    ], { city: "Indianapolis", state: "IN" })).toEqual({
      locationCode: 1001,
      locationName: "Indianapolis,Indiana,United States",
      locationType: "City",
    });
  });
});
