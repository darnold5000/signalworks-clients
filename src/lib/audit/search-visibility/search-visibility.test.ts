import { describe, expect, it } from "vitest";
import { generateDiscoveryCandidates, generateSearchQueries } from "@/lib/audit/search-visibility/query-generation";
import { hasSufficientDiscoveryCoverage, scoreSearchVisibility } from "@/lib/audit/search-visibility/scoring";
import { selectLocalQueryTerms, selectSearchProfile } from "@/lib/audit/search-profiles";
import { domainMatches, selectRelevantDiscovery } from "@/lib/audit/search-visibility/run";
import { matchUsLocation } from "@/lib/audit/search-visibility/client";

describe("search visibility phase 1", () => {
  it("generates distinct branded and discovery queries", () => {
    const queries = generateSearchQueries({ businessName: "Refined Indiana", city: "Plainfield", state: "IN", services: ["Personal Training", "Personal Training", "Our Services"] });
    expect(queries.filter((query) => query.type === "branded")).toHaveLength(2);
    expect(queries.filter((query) => query.type === "discovery").length).toBeGreaterThanOrEqual(6);
    expect(new Set(queries.map((query) => query.query.toLowerCase())).size).toBe(queries.length);
  });

  it("derives multiple sports-training intents from basketball evidence", () => {
    const queries = generateSearchQueries({ businessName: "Refined Indiana", city: "Indianapolis", state: "IN", services: ["Basketball Training in Indiana"] });
    expect(queries.filter((query) => query.type === "discovery").length).toBeGreaterThanOrEqual(3);
    expect(queries.some((query) => query.service === "sports performance training")).toBe(true);
    expect(queries.slice(2, 7).map((query) => query.service)).toEqual([
      "basketball training",
      "basketball trainer",
      "basketball skills training",
      "youth basketball training",
      "basketball lessons",
    ]);
  });

  it("prioritizes baseball intent before generic athletic terms", () => {
    const queries = generateSearchQueries({ businessName: "Baseball Academy", city: "Plainfield", state: "IN", services: ["Baseball Training and Development"] });
    expect(queries.slice(2, 7).map((query) => query.service)).toEqual([
      "baseball training",
      "baseball trainer",
      "baseball skills training",
      "youth baseball training",
      "baseball lessons",
    ]);
  });

  it("keeps generic sports terms when no specific sport is supported", () => {
    const queries = generateSearchQueries({ businessName: "Peak Performance", city: "Plainfield", state: "IN", services: ["Sports Performance Training"] });
    expect(queries.slice(2).some((query) => query.service === "sports performance training")).toBe(true);
    expect(queries.some((query) => query.service === "basketball training")).toBe(false);
  });

  it("rejects page-title brand contamination from discovery candidates", () => {
    const queries = generateSearchQueries({ businessName: "Refined Indiana", city: "Indianapolis", state: "IN", services: ["Basketball Training in Indiana | Refined Indiana"] });
    expect(queries.some((query) => query.query.includes("Basketball Training in Indiana Refined Indiana"))).toBe(false);
    expect(queries.filter((query) => query.type === "branded").map((query) => query.query)).toEqual(["Refined Indiana", "Refined Indiana Indianapolis IN"]);
  });

  it("keeps primary-service coverage when a secondary term has more demand", () => {
    const candidates = generateDiscoveryCandidates({ businessName: "Refined Indiana", city: "Indianapolis", state: "IN", services: ["Basketball Training", "Strength Training"] });
    const demand = new Map(candidates.map((candidate) => [candidate.service!, { query: candidate.service!, monthlySearchVolume: candidate.service === "strength training" ? 10000 : 1, competition: null, cpc: null, demandLevel: "high" as const, checkedAt: "now" }]));
    const selected = selectRelevantDiscovery(candidates, demand, 3);
    expect(selected.slice(0, 2).map((candidate) => candidate.service)).toEqual(["basketball training", "basketball trainer"]);
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

  it("recognizes basketball training as a sports-training profile", () => {
    const profile = selectSearchProfile({ businessName: "Refined Indiana", services: ["Basketball Training in Indiana"] });
    expect(profile.key).toBe("sports_training");
    expect(profile.baseTerms.length).toBeGreaterThan(2);
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
