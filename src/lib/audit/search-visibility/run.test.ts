import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSearchVisibility } from "./run";
import { fetchGoogleOrganicResults, resolveDataForSeoLocation } from "./client";
import { ensureSearchDemand } from "@/lib/audit/search-demand/client";
import { resolveGoogleAdsLocation } from "@/lib/audit/search-demand/location";

vi.mock("./client", () => ({
  fetchGoogleOrganicResults: vi.fn(),
  resolveDataForSeoLocation: vi.fn(),
}));

vi.mock("@/lib/audit/search-demand/client", () => ({ ensureSearchDemand: vi.fn() }));
vi.mock("@/lib/audit/search-demand/location", () => ({ resolveGoogleAdsLocation: vi.fn() }));

const serpLocation = { status: "resolved" as const, location: { locationCode: 1017146, locationName: "Indianapolis,Indiana,United States", locationType: "City" } };
const googleAdsLocation = { status: "resolved" as const, location: { locationCode: 2001001, locationName: "Indianapolis, Indiana, United States", countryIsoCode: "US", locationType: "City" }, error: null };

function demandMap(intents: string[]) {
  return { demandByIntent: new Map(intents.map((intent) => [intent, { query: intent, monthlySearchVolume: 500, competition: null, cpc: null, demandLevel: "high" as const, checkedAt: new Date().toISOString() }])), diagnostics: { providerRequestAttempted: true, providerHttpStatus: 200, providerTaskStatus: 20000, responseStatus: "received" as const, parseStatus: "succeeded" as const, resultCount: intents.length, persistenceAttempted: true, persistenceStatus: "succeeded" as const, failurePhase: null, failureCode: null, failureMessage: null } };
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
      if (keyword.toLowerCase() === "web design indianapolis indiana") throw new Error("DataForSEO HTTP 500");
      return { items: [{ type: "organic", url: "https://example.com/services", rank_absolute: 12 }], resultCount: 1, itemTypes: { organic: 1 }, taskId: "task-1", resultDepth: 30 };
    });

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results).toHaveLength(10);
    expect(result.results.filter((item) => item.collectionStatus === "failed")).toHaveLength(1);
    expect(result.diagnostics).toMatchObject({ failurePhase: "organic_serp", failureCode: "organic_query_partial_failure", successfulQueryCount: 9, failedQueryCount: 1 });
    expect(result.results.find((item) => item.collectionStatus === "failed")).toMatchObject({ position: null, found: false, collectionErrorCode: "organic_query_failed" });
  });

  it("returns unavailable when organic evidence falls below the minimum threshold", async () => {
    vi.mocked(fetchGoogleOrganicResults).mockRejectedValue(new Error("DataForSEO HTTP 500"));

    const result = await runAudit();

    expect(result.status).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.results).toHaveLength(10);
    expect(result.diagnostics).toMatchObject({ failurePhase: "organic_serp", failureCode: "organic_insufficient_coverage", successfulQueryCount: 0, failedQueryCount: 10 });
  });

  it("keeps organic rankings when Google Ads location resolution fails", async () => {
    vi.mocked(resolveGoogleAdsLocation).mockResolvedValue({ status: "provider_error", location: null, error: "DataForSEO Google Ads locations HTTP 401" });

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.every((item) => item.position === 12)).toBe(true);
    expect(result.results.filter((item) => item.type === "discovery").every((item) => item.monthlySearchVolume === null)).toBe(true);
    expect(result.demandLocation).toMatchObject({ status: "provider_error", googleAdsLocationCode: null });
  });

  it("keeps organic rankings when demand provider or persistence fails", async () => {
    vi.mocked(ensureSearchDemand).mockRejectedValue(new Error("demand persistence failed"));

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.filter((item) => item.type === "discovery").every((item) => item.monthlySearchVolume === null && item.opportunityScore === null)).toBe(true);
    expect(result.demandLocation).toMatchObject({ status: "provider_error", error: "demand persistence failed" });
  });

  it("preserves measured zero-volume demand without treating it as unavailable", async () => {
    vi.mocked(ensureSearchDemand).mockImplementation(async ({ intents }) => ({ ...demandMap(intents), demandByIntent: new Map(intents.map((intent) => [intent, { query: intent, monthlySearchVolume: 0, competition: null, cpc: null, demandLevel: "very_low" as const, checkedAt: new Date().toISOString() }])) }));

    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.results.find((item) => item.type === "discovery")?.monthlySearchVolume).toBe(0);
  });

  it("completes with diagnostics showing no failures when all organic queries succeed", async () => {
    const result = await runAudit();

    expect(result.status).toBe("completed");
    expect(result.diagnostics).toEqual({ failurePhase: null, failureCode: null, failureMessage: null, successfulQueryCount: 10, failedQueryCount: 0 });
  });
});
