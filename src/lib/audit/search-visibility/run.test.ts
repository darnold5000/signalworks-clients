import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSearchVisibility } from "./run";
import { fetchGoogleOrganicResults, resolveDataForSeoLocation } from "./client";
import { ensureSearchDemand } from "@/lib/audit/search-demand/client";
import { resolveGoogleAdsLocation } from "@/lib/audit/search-demand/location";
import { discoverSearchQueries } from "./discovery";

vi.mock("./client", () => ({
  fetchGoogleOrganicResults: vi.fn(),
  resolveDataForSeoLocation: vi.fn(),
}));

vi.mock("@/lib/audit/search-demand/client", () => ({ ensureSearchDemand: vi.fn() }));
vi.mock("@/lib/audit/search-demand/location", () => ({ resolveGoogleAdsLocation: vi.fn() }));
vi.mock("./discovery", () => ({ discoverSearchQueries: vi.fn() }));

const serpLocation = { status: "resolved" as const, location: { locationCode: 1017146, locationName: "Indianapolis,Indiana,United States", locationType: "City" } };
const googleAdsLocation = { status: "resolved" as const, location: { locationCode: 2001001, locationName: "Indianapolis, Indiana, United States", countryIsoCode: "US", locationType: "City" }, error: null };

const discoveryQueries = [
  { query: "web design", type: "discovery" as const, service: "web design", relevanceTier: 1 as const, relevanceSource: "primary_service" as const },
  { query: "website designer", type: "discovery" as const, service: "website designer", relevanceTier: 2 as const, relevanceSource: "website_evidence" as const },
  { query: "web development", type: "discovery" as const, service: "web development", relevanceTier: 2 as const, relevanceSource: "website_evidence" as const },
  { query: "software development", type: "discovery" as const, service: "software development", relevanceTier: 3 as const, relevanceSource: "website_evidence" as const },
  { query: "small business website design", type: "discovery" as const, service: "small business website design", relevanceTier: 3 as const, relevanceSource: "website_evidence" as const },
  { query: "web design company", type: "discovery" as const, service: "web design company", relevanceTier: 3 as const, relevanceSource: "website_evidence" as const },
];

function demandMap(intents: string[]) {
  return { demandByIntent: new Map(intents.map((intent) => [intent, { query: intent, monthlySearchVolume: 500, competition: null, cpc: null, demandLevel: "high" as const, checkedAt: new Date().toISOString() }])), diagnostics: { providerRequestAttempted: true, providerHttpStatus: 200, providerTaskStatus: 20000, responseStatus: "received" as const, parseStatus: "succeeded" as const, resultCount: intents.length, persistenceAttempted: true, persistenceStatus: "succeeded" as const, failurePhase: null, failureCode: null, failureMessage: null } };
}

function discoveryResult(overrides?: Partial<{ selected: typeof discoveryQueries; demand: number | null }>) {
  const selected = overrides?.selected ?? discoveryQueries;
  const volume = overrides?.demand === undefined ? 500 : overrides.demand;
  return {
    selected,
    demandByIntent: new Map(selected.map((item) => [item.query, { query: item.query, monthlySearchVolume: volume, competition: 20, cpc: 1, demandLevel: volume == null ? "unavailable" as const : volume >= 1 ? "high" as const : "very_low" as const, checkedAt: volume == null ? "" : new Date().toISOString() }])),
    diagnostics: {
      kfsRequestAttempted: true,
      kfsCacheHit: false,
      kfsProviderHttpStatus: 200,
      kfsProviderTaskStatus: 20000,
      kfsResultCount: selected.length,
      kfsEvidenceBackedCount: selected.length,
      kfkRequestAttempted: false,
      kfkResultCount: null,
      searchVolumeRequestAttempted: false,
      selectedQueryCount: selected.length,
      fallbackPath: "none" as const,
      failureReason: null,
    },
    evidenceBackedCount: selected.length,
  };
}

async function runAudit() {
  return runSearchVisibility({
    auditId: "run-diagnostics-test",
    normalizedUrl: "https://example.com",
    businessName: "Example Web",
    businessTypeHint: "web design company",
    city: "Indianapolis, Indiana",
    fetchHomepage: async () => ({ bodyText: "<h1>Web design</h1><h2>Software development</h2>" }),
    supabase: {} as never,
  });
}

describe("Search Visibility failure isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveDataForSeoLocation).mockResolvedValue(serpLocation);
    vi.mocked(resolveGoogleAdsLocation).mockResolvedValue(googleAdsLocation);
    vi.mocked(discoverSearchQueries).mockResolvedValue(discoveryResult());
    vi.mocked(ensureSearchDemand).mockImplementation(async ({ intents }) => demandMap(intents));
    vi.mocked(fetchGoogleOrganicResults).mockResolvedValue({
      items: [{ type: "organic", url: "https://example.com/services", rank_absolute: 12 }],
      resultCount: 1,
      itemTypes: { organic: 1 },
      taskId: "task-1",
      resultDepth: 30,
    });
  });

  it.each([
    ["SERP location failure", "DataForSEO locations HTTP 401"],
    ["SERP provider failure", "DataForSEO locations HTTP 500"],
  ])("returns unavailable with a diagnostic reason for %s", async (_label, reason) => {
    vi.mocked(resolveDataForSeoLocation).mockResolvedValue({ status: "unavailable", reason });

    const result = await runAudit();

    expect(result.status).toBe("unavailable");
    expect(result.results).toHaveLength(0);
    expect(result.errorMessage).toBe(reason);
  });

  it("persists SERP location timeout diagnostics before any organic query runs", async () => {
    vi.mocked(resolveDataForSeoLocation).mockResolvedValue({
      status: "unavailable",
      reason: "The operation was aborted due to timeout",
      diagnostics: {
        failurePhase: "serp_location_resolution",
        failureCode: "serp_location_resolution_timeout",
        failureMessage: "The operation was aborted due to timeout",
      },
    });

    const result = await runAudit();

    expect(result.status).toBe("unavailable");
    expect(result.diagnostics).toMatchObject({
      failurePhase: "serp_location_resolution",
      failureCode: "serp_location_resolution_timeout",
      successfulQueryCount: 0,
      failedQueryCount: 0,
    });
    expect(fetchGoogleOrganicResults).not.toHaveBeenCalled();
  });

  it("preserves a distinct diagnostic for non-timeout SERP location failures", async () => {
    vi.mocked(resolveDataForSeoLocation).mockResolvedValue({
      status: "unavailable",
      reason: "DataForSEO locations HTTP 500",
      diagnostics: {
        failurePhase: "serp_location_resolution",
        failureCode: "serp_location_resolution_failed",
        failureMessage: "DataForSEO locations HTTP 500",
      },
    });

    const result = await runAudit();

    expect(result.diagnostics).toMatchObject({
      failurePhase: "serp_location_resolution",
      failureCode: "serp_location_resolution_failed",
      failureMessage: "DataForSEO locations HTTP 500",
    });
    expect(fetchGoogleOrganicResults).not.toHaveBeenCalled();
  });

  it("keeps successful organic results when one SERP query fails", async () => {
    vi.mocked(fetchGoogleOrganicResults).mockImplementation(async ({ keyword }) => {
      if (keyword.toLowerCase() === "web design") throw new Error("DataForSEO HTTP 500");
      return { items: [{ type: "organic", url: "https://example.com/services", rank_absolute: 12 }], resultCount: 1, itemTypes: { organic: 1 }, taskId: "task-1", resultDepth: 30 };
    });

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results).toHaveLength(8);
    expect(result.results.filter((item) => item.collectionStatus === "failed")).toHaveLength(1);
    expect(result.diagnostics).toMatchObject({ failurePhase: "organic_serp", failureCode: "organic_query_partial_failure", successfulQueryCount: 7, failedQueryCount: 1 });
    expect(result.results.find((item) => item.collectionStatus === "failed")).toMatchObject({ position: null, found: false, collectionErrorCode: "organic_query_failed" });
  });

  it("returns unavailable when organic evidence falls below the minimum threshold", async () => {
    vi.mocked(fetchGoogleOrganicResults).mockRejectedValue(new Error("DataForSEO HTTP 500"));

    const result = await runAudit();

    expect(result.status).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.results).toHaveLength(8);
    expect(result.diagnostics).toMatchObject({ failurePhase: "organic_serp", failureCode: "organic_insufficient_coverage", successfulQueryCount: 0, failedQueryCount: 8 });
  });

  it("keeps organic rankings when Google Ads location resolution fails", async () => {
    vi.mocked(resolveGoogleAdsLocation).mockResolvedValue({ status: "provider_error", location: null, error: "DataForSEO Google Ads locations HTTP 401" });
    vi.mocked(discoverSearchQueries).mockResolvedValue(discoveryResult({ demand: null }));

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.every((item) => item.position === 12)).toBe(true);
    expect(result.results.filter((item) => item.type === "discovery").every((item) => item.monthlySearchVolume === null)).toBe(true);
    expect(result.demandLocation).toMatchObject({ status: "provider_error", googleAdsLocationCode: null });
  });

  it("keeps organic rankings when demand provider or persistence fails", async () => {
    vi.mocked(discoverSearchQueries).mockResolvedValue(discoveryResult({ demand: null }));
    vi.mocked(ensureSearchDemand).mockRejectedValue(new Error("demand persistence failed"));

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.filter((item) => item.type === "discovery").every((item) => item.monthlySearchVolume === null && item.opportunityScore === null)).toBe(true);
    expect(result.demandLocation).toMatchObject({ status: "provider_error", error: "demand persistence failed" });
  });

  it("preserves measured zero-volume demand without treating it as unavailable", async () => {
    vi.mocked(discoverSearchQueries).mockResolvedValue(discoveryResult({ demand: 0 }));

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.find((item) => item.type === "discovery")?.monthlySearchVolume).toBe(0);
  });

  it("completes with diagnostics showing no failures when all organic queries succeed", async () => {
    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.diagnostics).toEqual({ failurePhase: null, failureCode: null, failureMessage: null, successfulQueryCount: 8, failedQueryCount: 0 });
  });

  it("does not call search_volume when KFS already supplied demand for selected terms", async () => {
    await runAudit();
    expect(ensureSearchDemand).not.toHaveBeenCalled();
  });

  it("passes clean discovery keywords with the resolved location separately", async () => {
    await runAudit();

    expect(vi.mocked(fetchGoogleOrganicResults).mock.calls.filter(([input]) => input.keyword !== "Example Web" && input.keyword !== "Example Web Indianapolis Indiana").every(([input]) => !/indianapolis|indiana/i.test(input.keyword) && input.locationCode === 1017146)).toBe(true);
  });
});
