import { describe, expect, it } from "vitest";
import { generateSearchQueries } from "@/lib/audit/search-visibility/query-generation";
import { hasSufficientDiscoveryCoverage, scoreSearchVisibility } from "@/lib/audit/search-visibility/scoring";
import { selectLocalQueryTerms, selectSearchProfile } from "@/lib/audit/search-profiles";
import { domainMatches } from "@/lib/audit/search-visibility/run";
import { matchUsLocation } from "@/lib/audit/search-visibility/client";

describe("search visibility phase 1", () => {
  it("generates distinct branded and discovery queries", () => {
    const queries = generateSearchQueries({ businessName: "Refined Indiana", city: "Plainfield", state: "IN", services: ["Personal Training", "Personal Training", "Our Services"] });
    expect(queries.filter((query) => query.type === "branded")).toHaveLength(2);
    expect(queries.filter((query) => query.type === "discovery")).toHaveLength(6);
    expect(new Set(queries.map((query) => query.query.toLowerCase())).size).toBe(queries.length);
  });

  it("rejects homepage marketing copy and supplies realistic web-service discovery queries", () => {
    const queries = generateSearchQueries({ businessName: "Signal Works", businessTypeHint: "Web design & software development", city: "Plainfield", state: "IN", services: ["Websites, software, and AI — without agency pricing."] });
    const discovery = queries.filter((query) => query.type === "discovery");
    expect(discovery).toHaveLength(8);
    expect(discovery.map((query) => query.service)).toEqual(expect.arrayContaining(["web design", "website designer", "web development", "software development"]));
    expect(discovery.some((query) => /without agency pricing/i.test(query.query))).toBe(false);
  });

  it("uses a business type hint when website evidence is not specific", () => {
    const queries = generateSearchQueries({ businessName: "Example Advisors", businessTypeHint: "Financial advisor", city: "Plainfield", state: "IN", services: ["Welcome to our business"] });
    expect(queries.filter((query) => query.type === "discovery").map((query) => query.query)).toContain("financial advisor Plainfield IN");
  });

  it("does not let a contradictory hint override strong website evidence", () => {
    const profile = selectSearchProfile({ businessName: "Example Dental", businessTypeHint: "Web design", services: ["dentist", "cosmetic dentist"] });
    expect(profile.key).toBe("dentist");
    expect(profile.hintDisagreed).toBe(true);
  });

  it("does not score an audit with only one discovery query", () => {
    const results = [{ query: "unvalidated headline", type: "discovery" as const, service: null, position: null, found: false, rankingUrl: null, checkedAt: "now", searchEngine: "google" as const, location: "Plainfield, Indiana" }];
    expect(hasSufficientDiscoveryCoverage(results)).toBe(false);
    expect(scoreSearchVisibility(results).score).toBe(0);
  });

  it("keeps local terms tied to the current web-services profile", () => {
    const profile = selectSearchProfile({ businessName: "Signal Works", services: ["web design Plainfield IN", "software development Plainfield IN"] });
    expect(profile.key).toBe("web_services");
    expect(selectLocalQueryTerms({ profile, discoveryQueries: ["web design Plainfield IN", "software development Plainfield IN"] })).not.toContain("financial advisor");
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

  it("normalizes explicit city and state inputs", () => {
    const locations = [
      { location_code: 1001, location_name: "Plainfield,Indiana,United States", location_type: "City", country_iso_code: "US" },
      { location_code: 1002, location_name: "Plainfield,Illinois,United States", location_type: "City", country_iso_code: "US" },
    ];
    expect(matchUsLocation(locations, { city: "Plainfield", state: "IN" })?.locationName).toBe("Plainfield,Indiana,United States");
    expect(matchUsLocation(locations, { city: "Plainfield", state: "Indiana" })?.locationName).toBe("Plainfield,Indiana,United States");
  });
});
