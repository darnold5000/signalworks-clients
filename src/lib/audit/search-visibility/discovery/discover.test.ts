import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverSearchQueries } from "./index";
import { persistSearchDemandMetrics } from "@/lib/audit/search-demand/client";
import { selectSearchProfile } from "@/lib/audit/search-profiles";

const indianapolis = {
  locationCode: 2001001,
  locationName: "Indianapolis, Indiana, United States",
  countryIsoCode: "US",
  locationType: "City",
};

function kfsResponse(keywords: Array<{ keyword: string; search_volume: number; isBrand?: boolean }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        result_count: keywords.length,
        result: keywords.map((item) => ({
          keyword: item.keyword,
          search_volume: item.search_volume,
          cpc: 1.2,
          competition_index: 30,
          location_code: indianapolis.locationCode,
          keyword_annotations: item.isBrand ? { concepts: [{ name: "Brand", concept_group: { name: "Brands", type: "BRAND" } }] } : { concepts: [{ name: "Non-Brands", concept_group: { name: "Non-Brands", type: "NON_BRAND" } }] },
        })),
      }],
    }),
  };
}

function supabaseMock(options?: { discovery?: { candidates_json: unknown; source?: string; checked_at?: string; location_code?: number } | null }) {
  const upserts: Array<{ table: string; rows: unknown }> = [];
  const from = (table: string) => {
    const filters = new Map<string, unknown>();
    const query: Record<string, unknown> = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      in: () => query,
      maybeSingle: async () => {
        if (table === "search_keyword_discovery") {
          const row = options?.discovery ?? null;
          if (row && (row.location_code == null || filters.get("location_code") === row.location_code)) {
            return { data: row, error: null };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      upsert: async (rows: unknown) => {
        upserts.push({ table, rows });
        return { error: null };
      },
    };
    return query;
  };
  return { client: { from } as never, upserts };
}

const gymnasticsHtml = `<title>Flip Zone Gymnastics</title><h1>Gymnastics Classes</h1><h2>Tumbling</h2><h2>Preschool Gymnastics</h2><p>Kids gymnastics and tumbling classes in the Indianapolis area.</p>`;
const dentistHtml = `<title>Family Dentist</title><h1>Dentist</h1><h2>Cosmetic Dentist</h2>`;
const financialHtml = `<title>Wealth Management</title><h1>Financial Advisor</h1><h2>Retirement Planning</h2>`;
const rooferHtml = `<title>Roof Repair</title><h1>Roofing</h1><h2>Roof Replacement</h2>`;
const weddingHtml = `<title>Wedding Venue</title><h1>Wedding Venue</h1><h2>Ceremony Gardens</h2>`;
const musicHtml = `<title>Piano Lessons</title><h1>Music Teacher</h1><h2>Piano Lessons</h2>`;

describe("KFS-first keyword discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
  });

  it("discovers unknown categories without a hard-coded profile", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    const cases = [
      { html: rooferHtml, name: "Summit Roofing", hint: null, keywords: ["roofing", "roof repair", "roof replacement", "emergency roof repair"] },
      { html: weddingHtml, name: "Garden Hall", hint: null, keywords: ["wedding venue", "wedding venues", "ceremony venue", "event venue"] },
      { html: musicHtml, name: "Keys Studio", hint: null, keywords: ["piano lessons", "music teacher", "piano teacher", "music lessons"] },
    ];
    for (const example of cases) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(kfsResponse(example.keywords.map((keyword) => ({ keyword, search_volume: 200 }))) as Response);
      const { client } = supabaseMock();
      const result = await discoverSearchQueries({
        supabase: client,
        auditId: "unknown",
        normalizedDomain: "example.com",
        html: example.html,
        businessName: example.name,
        businessTypeHint: example.hint,
        city: "Indianapolis",
        state: "Indiana",
        googleAdsLocation: indianapolis,
        profile: selectSearchProfile({ businessName: example.name, services: [] }),
        services: [],
      });
      expect(result.selected.length).toBeGreaterThanOrEqual(3);
      expect(result.diagnostics.kfsRequestAttempted).toBe(true);
      expect(result.selected.every((item) => !/indianapolis|indiana/i.test(item.query))).toBe(true);
      expect(selectSearchProfile({ businessName: example.name, services: [] }).key).not.toBe("dentist");
      vi.restoreAllMocks();
    }
  });

  it("discovers gymnastics without a gymnastics profile and skips search_volume for KFS terms", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(kfsResponse([
      { keyword: "gymnastics classes", search_volume: 480 },
      { keyword: "kids gymnastics", search_volume: 320 },
      { keyword: "tumbling classes", search_volume: 210 },
      { keyword: "preschool gymnastics", search_volume: 170 },
      { keyword: "personal trainer", search_volume: 12000 },
      { keyword: "flip zone gymnastics", search_volume: 50 },
      { keyword: "gymnastics classes indianapolis", search_volume: 90 },
    ]) as Response);
    const { client, upserts } = supabaseMock();
    const result = await discoverSearchQueries({
      supabase: client,
      auditId: "flip-zone",
      normalizedDomain: "theflipzone.com",
      html: gymnasticsHtml,
      businessName: "Flip Zone",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Flip Zone", services: ["Gymnastics Classes"] }),
      services: ["Gymnastics Classes"],
    });
    expect(selectSearchProfile({ businessName: "Flip Zone", services: ["Gymnastics Classes"] }).key).not.toBe("fitness_gym");
    expect(result.selected.length).toBeGreaterThanOrEqual(3);
    expect(result.selected.map((item) => item.query)).toEqual(expect.arrayContaining(["gymnastics classes"]));
    expect(result.selected.some((item) => /personal trainer|fitness|gym\b/i.test(item.query))).toBe(false);
    expect(result.selected.some((item) => /flip zone|indianapolis/i.test(item.query))).toBe(false);
    expect(result.demandByIntent.get("gymnastics classes")?.monthlySearchVolume).toBe(480);
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("search_volume"))).toBe(false);
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("keywords_for_site"))).toBe(true);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))[0]).toMatchObject({
      target: "theflipzone.com",
      target_type: "site",
      location_code: indianapolis.locationCode,
      language_code: "en",
    });
    expect(upserts.some((item) => item.table === "search_intent_demand")).toBe(true);
  });

  it("keeps dentist and financial advisor discovery working without relying on profiles as a gate", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(kfsResponse([
      { keyword: "dentist", search_volume: 1000 },
      { keyword: "family dentist", search_volume: 400 },
      { keyword: "cosmetic dentist", search_volume: 300 },
      { keyword: "emergency dentist", search_volume: 250 },
    ]) as Response);
    const dentist = await discoverSearchQueries({
      supabase: supabaseMock().client,
      auditId: "dentist",
      normalizedDomain: "example-dental.com",
      html: dentistHtml,
      businessName: "Example Dental",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Example Dental", services: ["dentist"] }),
      services: ["dentist"],
    });
    expect(dentist.selected.map((item) => item.query)).toEqual(expect.arrayContaining(["dentist"]));
    expect(dentist.selected.length).toBeGreaterThanOrEqual(3);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(kfsResponse([
      { keyword: "financial advisor", search_volume: 900 },
      { keyword: "wealth management", search_volume: 700 },
      { keyword: "financial planner", search_volume: 500 },
      { keyword: "retirement planning", search_volume: 400 },
    ]) as Response);
    const financial = await discoverSearchQueries({
      supabase: supabaseMock().client,
      auditId: "financial",
      normalizedDomain: "example-advisors.com",
      html: financialHtml,
      businessName: "Example Advisors",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Example Advisors", services: ["wealth management"] }),
      services: ["wealth management"],
    });
    expect(financial.selected.map((item) => item.query)).toEqual(expect.arrayContaining(["financial advisor", "wealth management"]));
  });

  it("reuses a fresh same-market discovery cache and does not call KFS", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await discoverSearchQueries({
      supabase: supabaseMock({
        discovery: {
          source: "dataforseo_google_ads_keywords_for_site",
          checked_at: new Date().toISOString(),
          location_code: indianapolis.locationCode,
          candidates_json: [
            { keyword: "gymnastics classes", relevanceTier: 1, relevanceSource: "primary_service", searchVolume: 480, cpc: 1, competition: 20 },
            { keyword: "kids gymnastics", relevanceTier: 2, relevanceSource: "website_evidence", searchVolume: 320, cpc: 1, competition: 20 },
            { keyword: "tumbling classes", relevanceTier: 3, relevanceSource: "website_evidence", searchVolume: 210, cpc: 1, competition: 20 },
          ],
        },
      }).client,
      auditId: "cache-hit",
      normalizedDomain: "theflipzone.com",
      html: gymnasticsHtml,
      businessName: "Flip Zone",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Flip Zone", services: ["Gymnastics Classes"] }),
      services: ["Gymnastics Classes"],
    });
    expect(result.diagnostics.kfsCacheHit).toBe(true);
    expect(result.diagnostics.kfsRequestAttempted).toBe(false);
    expect(result.selected.length).toBeGreaterThanOrEqual(3);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not reuse a different market cache row", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(kfsResponse([
      { keyword: "gymnastics classes", search_volume: 100 },
      { keyword: "kids gymnastics", search_volume: 80 },
      { keyword: "tumbling classes", search_volume: 70 },
    ]) as Response);
    const { client } = supabaseMock({
      discovery: {
        source: "dataforseo_google_ads_keywords_for_site",
        checked_at: new Date().toISOString(),
        location_code: 999,
        candidates_json: [{ keyword: "carmel only", relevanceTier: 1, relevanceSource: "primary_service", searchVolume: 1, cpc: null, competition: null }],
      },
    });
    const result = await discoverSearchQueries({
      supabase: client,
      auditId: "other-market",
      normalizedDomain: "theflipzone.com",
      html: gymnasticsHtml,
      businessName: "Flip Zone",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Flip Zone", services: ["Gymnastics Classes"] }),
      services: ["Gymnastics Classes"],
    });
    expect(result.diagnostics.kfsCacheHit).toBe(false);
    expect(result.diagnostics.kfsRequestAttempted).toBe(true);
    expect(result.selected.some((item) => item.query === "carmel only")).toBe(false);
    expect(fetch).toHaveBeenCalled();
  });

  it("falls back from KFS to KFK to website/profile phrases, then the safeguard", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("keywords_for_site")) return kfsResponse([]) as Response;
      if (String(url).includes("keywords_for_keywords")) return kfsResponse([
        { keyword: "gymnastics classes", search_volume: 200 },
        { keyword: "kids gymnastics", search_volume: 150 },
        { keyword: "tumbling classes", search_volume: 90 },
      ]) as Response;
      throw new Error(`unexpected url ${String(url)}`);
    });
    const kfk = await discoverSearchQueries({
      supabase: supabaseMock().client,
      auditId: "kfk",
      normalizedDomain: "theflipzone.com",
      html: gymnasticsHtml,
      businessName: "Flip Zone",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Flip Zone", services: ["Gymnastics Classes"] }),
      services: ["Gymnastics Classes"],
    });
    expect(kfk.diagnostics.kfkRequestAttempted).toBe(true);
    expect(kfk.diagnostics.fallbackPath).toBe("keywords_for_keywords");
    expect(kfk.selected.length).toBeGreaterThanOrEqual(3);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider down"));
    const website = await discoverSearchQueries({
      supabase: supabaseMock().client,
      auditId: "website-fallback",
      normalizedDomain: "example-advisors.com",
      html: financialHtml,
      businessName: "Example Advisors",
      businessTypeHint: "Financial advisor",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Example Advisors", businessTypeHint: "Financial advisor", services: ["Welcome to our business"] }),
      services: ["Welcome to our business"],
    });
    expect(website.diagnostics.fallbackPath).toBe("profile_or_website");
    expect(website.selected.length).toBeGreaterThanOrEqual(3);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider down"));
    const insufficient = await discoverSearchQueries({
      supabase: supabaseMock().client,
      auditId: "insufficient",
      normalizedDomain: "thin.example",
      html: "<title>Hello</title><h1>Welcome</h1>",
      businessName: "Hello Co",
      city: "Indianapolis",
      state: "Indiana",
      googleAdsLocation: indianapolis,
      profile: selectSearchProfile({ businessName: "Hello Co", services: [] }),
      services: [],
    });
    expect(insufficient.selected.length).toBeLessThan(3);
    expect(insufficient.diagnostics.fallbackPath).toBe("insufficient");
    expect(insufficient.diagnostics.failureReason).toBe("insufficient_discovery_coverage");
  });
});

describe("persistSearchDemandMetrics", () => {
  it("does not overwrite a still-fresh demand row", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: () => ({
        select: () => supabase.from(),
        in: () => supabase.from(),
        eq: () => supabase.from(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: [{
            normalized_intent: "gymnastics classes",
            display_intent: "gymnastics classes",
            monthly_search_volume: 480,
            demand_level: "moderate",
            competition: 20,
            competition_index: 20,
            cpc: 1,
            checked_at: new Date().toISOString(),
            location_code: indianapolis.locationCode,
            country_code: "US",
            language_code: "en",
          }],
          error: null,
        }).then(resolve),
        upsert,
      }),
    };
    const result = await persistSearchDemandMetrics({
      supabase: supabase as never,
      items: [{ query: "gymnastics classes", searchVolume: 10, competition: 1, cpc: 9 }],
      googleAdsLocation: indianapolis,
      source: "dataforseo_google_ads_keywords_for_site",
    });
    expect(result.get("gymnastics classes")?.monthlySearchVolume).toBe(480);
    expect(upsert).not.toHaveBeenCalled();
  });
});
