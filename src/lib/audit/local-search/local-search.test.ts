import { describe, expect, it, vi } from "vitest";
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
    expect(selectLocalQueryTerms({ profile: { key: "financial_advisor", applicable: true, baseTerms: ["financial advisor", "wealth management", "financial planner", "retirement planning", "wealth advisor"] }, discoveryQueries: ["wealth management", "financial advisor", "financial planner", "retirement planning", "retirement advisor", "investment management", "business retirement plans", "wealth advisor"] })).toHaveLength(5);
  });

  it("keeps primary-service local queries ahead of generic profile terms", () => {
    const terms = selectLocalQueryTerms({
      profile: { key: "sports_training", applicable: true, baseTerms: ["sports performance training", "athletic training", "strength training"] },
      discoveryQueries: [
        { query: "basketball training", relevanceTier: 1 },
        { query: "basketball trainer", relevanceTier: 2 },
        { query: "basketball lessons", relevanceTier: 2 },
        { query: "strength training", relevanceTier: 4 },
      ],
    });
    expect(terms.slice(0, 3)).toEqual([
      "basketball training",
      "basketball trainer",
      "basketball lessons",
    ]);
  });

  it("does not add unsupported Tier-4 profile defaults to fill local queries", () => {
    const terms = selectLocalQueryTerms({
      profile: { key: "sports_training", applicable: true, baseTerms: ["sports performance training"] },
      discoveryQueries: [
        { query: "basketball training", relevanceTier: 1 },
        { query: "basketball trainer", relevanceTier: 2 },
        { query: "sports performance training", relevanceTier: 4 },
      ],
    });
    expect(terms).toEqual(["basketball training", "basketball trainer"]);
  });

  it("sends clean local keywords with the resolved location separately", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, id: "task-1", result: [{ items: [] }] }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await runLocalSearch({
      auditId: "run-clean-local-query",
      normalizedUrl: "https://example.com",
      businessName: "Refined Indiana",
      businessTypeHint: "basketball training",
      enteredMarket: "Sheridan, IN",
      city: "Sheridan",
      state: "Indiana",
      locationCode: 1234,
      locationName: "Sheridan,Indiana,United States",
      homepageText: "",
      discoveryQueries: [
        { query: "basketball training", relevanceTier: 1 },
        { query: "basketball trainer", relevanceTier: 2 },
      ],
    });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo, RequestInit]>;
    const requests = calls.map(([, init]) => JSON.parse(String(init.body)) as Array<{ keyword: string; location_code: number }>);
    expect(requests.map((request) => request[0])).toMatchObject([
      { keyword: "basketball training", location_code: 1234 },
      { keyword: "basketball trainer", location_code: 1234 },
    ]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("completes five valid zero-result searches with metadata preserved", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40102, status_message: "No Search Results.", result: null }] }), { status: 200 })));

    const result = await runLocalSearch({
      auditId: "run-zero-results",
      normalizedUrl: "https://refined-indiana.com",
      businessName: "Refined Indiana",
      businessTypeHint: "basketball training",
      enteredMarket: "Sheridan, IN",
      city: "Sheridan",
      state: "Indiana",
      locationCode: 1017305,
      locationName: "Sheridan,Indiana,United States",
      homepageText: "",
      discoveryQueries: [
        { query: "basketball training", relevanceTier: 1 },
        { query: "basketball trainer", relevanceTier: 2 },
        { query: "basketball skills training", relevanceTier: 2 },
        { query: "youth basketball training", relevanceTier: 2 },
        { query: "basketball lessons", relevanceTier: 2 },
      ],
    });

    expect(result).toMatchObject({ status: "completed", score: 0, profileKey: "sports_training", normalizedMarket: "Sheridan,Indiana,United States", locationName: "Sheridan,Indiana,United States", locationCode: 1017305 });
    expect(result.summary).toMatchObject({ foundCount: 0, queriesAnalyzed: 5, score: 0 });
    expect(result.results).toHaveLength(5);
    expect(result.results.every((item) => item.found === false && item.position === null)).toBe(true);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("uses the upstream discovery set without reclassifying from the query list", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "test-login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "test-password");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40102, status_message: "No Search Results.", result: null }] }), { status: 200 })));

    const discoveryQueries = [
      { query: "gymnastics classes", relevanceTier: 1 as const },
      { query: "kids gymnastics", relevanceTier: 2 as const },
      { query: "tumbling classes", relevanceTier: 3 as const },
    ];
    const result = await runLocalSearch({
      auditId: "run-upstream-discovery",
      normalizedUrl: "https://theflipzone.com",
      businessName: "Flip Zone",
      enteredMarket: "Indianapolis, IN",
      city: "Indianapolis",
      state: "Indiana",
      locationCode: 1017146,
      locationName: "Indianapolis,Indiana,United States",
      homepageText: "",
      discoveryQueries,
      profileKey: "generic_local_business",
    });

    expect(result.status).toBe("completed");
    expect(result.profileKey).toBe("generic_local_business");
    expect(result.results.map((item) => item.query)).toEqual(["gymnastics classes", "kids gymnastics", "tumbling classes"]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("preserves not applicable for a clearly non-local business", async () => {
    const result = await runLocalSearch({ auditId: "run-2", normalizedUrl: "https://example.com", businessName: "Cloud Platform", businessTypeHint: "software platform", enteredMarket: "Indianapolis, IN", city: "Indianapolis", state: "Indiana", locationCode: 1017146, locationName: "Indianapolis, Indiana, United States", homepageText: "", discoveryQueries: [] });
    expect(result.status).toBe("not_applicable");
    expect(result.score).toBeNull();
  });
});
