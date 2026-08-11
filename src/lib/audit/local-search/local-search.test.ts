import { describe, expect, it } from "vitest";
import { selectSearchProfile, selectLocalQueryTerms } from "@/lib/audit/search-profiles";
import { localBusinessMatches } from "@/lib/audit/local-search/matching";
import { scoreLocalSearch } from "@/lib/audit/local-search/scoring";

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

  it("prefers domain and rejects similarly named businesses", () => {
    expect(localBusinessMatches({ item: { title: "Market Street Wealth", domain: "marketstreetwealth.com" }, businessName: "Market Street Wealth", targetDomain: "marketstreetwealth.com" })).toBe(true);
    expect(localBusinessMatches({ item: { title: "Market Street Wealth Advisors", domain: "other.example" }, businessName: "Market Street Wealth", targetDomain: "marketstreetwealth.com" })).toBe(false);
  });

  it("scores not-found local results as a valid zero", () => {
    const summary = scoreLocalSearch([{ query: "dentist Indianapolis", position: null, found: false, businessName: null, websiteDomain: null, resultUrl: null, location: "Indianapolis,Indiana,United States", checkedAt: "now" }]);
    expect(summary.score).toBe(0);
    expect(summary.notFoundCount).toBe(1);
  });
});
