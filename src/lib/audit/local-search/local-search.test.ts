import { describe, expect, it } from "vitest";
import { selectSearchProfile, selectLocalQueryTerms } from "@/lib/audit/search-profiles";
import { localBusinessMatches } from "@/lib/audit/local-search/matching";
import { scoreLocalSearch } from "@/lib/audit/local-search/scoring";
import { runLocalSearch } from "@/lib/audit/local-search/run";

describe("local search phase 2", () => {
  it("selects local profiles and rejects SaaS applicability", () => {
    expect(selectSearchProfile({ businessName: "Market Street Wealth", services: ["wealth management"] }).key).toBe("financial_advisor");
    expect(selectSearchProfile({ businessName: "Cloud Platform", services: ["software platform"] }).applicable).toBe(false);
  });

  it("does not classify local search from unrelated homepage copy", () => {
    expect(selectSearchProfile({ businessName: "Signal Works", services: ["web design Plainfield IN"], content: "financial planning resources" }).key).toBe("web_services");
  });

  it("selects no more than five local queries", () => {
    expect(selectLocalQueryTerms({ profile: { key: "financial_advisor", applicable: true, baseTerms: ["financial advisor", "wealth management", "financial planner", "retirement planning", "wealth advisor"] }, discoveryQueries: ["wealth management Indianapolis", "financial advisor Indianapolis", "financial planner Indianapolis", "retirement planning Indianapolis", "retirement advisor Indianapolis", "investment management Indianapolis", "business retirement plans Indianapolis", "wealth advisor Indianapolis"] })).toHaveLength(5);
  });

  it("keeps primary-service local queries ahead of generic profile terms", () => {
    const terms = selectLocalQueryTerms({
      profile: { key: "sports_training", applicable: true, baseTerms: ["sports performance training", "athletic training", "strength training"] },
      discoveryQueries: [
        { query: "basketball training Indianapolis", relevanceTier: 1 },
        { query: "basketball trainer Indianapolis", relevanceTier: 2 },
        { query: "basketball lessons Indianapolis", relevanceTier: 2 },
        { query: "strength training Indianapolis", relevanceTier: 4 },
      ],
    });
    expect(terms.slice(0, 3)).toEqual([
      "basketball training Indianapolis",
      "basketball trainer Indianapolis",
      "basketball lessons Indianapolis",
    ]);
  });

  it("does not add unsupported Tier-4 profile defaults to fill local queries", () => {
    const terms = selectLocalQueryTerms({
      profile: { key: "sports_training", applicable: true, baseTerms: ["sports performance training"] },
      discoveryQueries: [
        { query: "basketball training Indianapolis", relevanceTier: 1 },
        { query: "basketball trainer Indianapolis", relevanceTier: 2 },
        { query: "sports performance training Indianapolis", relevanceTier: 4 },
      ],
    });
    expect(terms).toEqual(["basketball training Indianapolis", "basketball trainer Indianapolis"]);
  });

  it("prefers domain and rejects similarly named businesses", () => {
    expect(localBusinessMatches({ item: { title: "Market Street Wealth", domain: "marketstreetwealth.com" }, businessName: "Market Street Wealth", targetDomain: "marketstreetwealth.com" })).toBe(true);
    expect(localBusinessMatches({ item: { title: "Market Street Wealth Advisors", domain: "other.example" }, businessName: "Market Street Wealth", targetDomain: "marketstreetwealth.com" })).toBe(false);
  });

  it("scores not-found local results as a valid zero", () => {
    const summary = scoreLocalSearch([{ query: "dentist Indianapolis", position: null, found: false, businessName: null, websiteDomain: null, resultUrl: null, location: "Indianapolis,Indiana,United States", checkedAt: "now" }]);
    expect(summary.score).toBe(0);
    expect(summary.notFoundCount).toBe(1);
  });

  it("marks a local-capable audit as not measured when discovery evidence is missing", async () => {
    const result = await runLocalSearch({ auditId: "run-1", normalizedUrl: "https://example.com", businessName: "Example", businessTypeHint: "basketball", enteredMarket: "Indianapolis, IN", city: "Indianapolis", state: "Indiana", locationCode: 1017146, locationName: "Indianapolis, Indiana, United States", homepageText: "", discoveryQueries: [] });
    expect(result.status).toBe("not_measured");
    expect(result.score).toBeNull();
  });

  it("preserves not applicable for a clearly non-local business", async () => {
    const result = await runLocalSearch({ auditId: "run-2", normalizedUrl: "https://example.com", businessName: "Cloud Platform", businessTypeHint: "software platform", enteredMarket: "Indianapolis, IN", city: "Indianapolis", state: "Indiana", locationCode: 1017146, locationName: "Indianapolis, Indiana, United States", homepageText: "", discoveryQueries: [] });
    expect(result.status).toBe("not_applicable");
    expect(result.score).toBeNull();
  });
});
