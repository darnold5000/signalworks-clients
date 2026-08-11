import { afterEach, describe, expect, it, vi } from "vitest";
import { demandLevelForVolume, normalizeDemand } from "./normalize";
import { opportunityForQuery } from "./opportunity";
import { ensureSearchDemand } from "./client";

function demandRow(intent: string, checkedAt: string, volume: number | null) {
  return {
    normalized_intent: intent,
    display_intent: intent,
    monthly_search_volume: volume,
    demand_level: demandLevelForVolume(volume),
    competition: null,
    competition_index: null,
    cpc: null,
    checked_at: checkedAt,
  };
}

function supabaseForDemand(rows: unknown[]) {
  const selectResult = Promise.resolve({ data: rows, error: null });
  const table = {
    select: () => table,
    in: () => table,
    eq: () => table,
    then: selectResult.then.bind(selectResult),
    upsert: () => Promise.resolve({ error: null }),
  };
  return { from: () => table } as never;
}

function providerResponse(results: Array<Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({
      status_code: 20000,
      tasks: [{ status_code: 20000, result: results }],
    }),
  };
}

describe("search demand and opportunities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
  });

  it("uses transparent demand thresholds", () => {
    expect(demandLevelForVolume(500)).toBe("high");
    expect(demandLevelForVolume(100)).toBe("moderate");
    expect(demandLevelForVolume(20)).toBe("low");
    expect(demandLevelForVolume(1)).toBe("very_low");
    expect(demandLevelForVolume(null)).toBe("unavailable");
  });

  it("does not turn missing demand into zero demand", () => {
    const demand = normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: null, checkedAt: "now" });
    expect(demand.monthlySearchVolume).toBeNull();
    expect(demand.demandLevel).toBe("unavailable");
  });

  it("makes high demand outside the top 30 a high-priority opportunity", () => {
    const opportunity = opportunityForQuery({ query: "financial advisor Indianapolis", type: "discovery", service: "financial advisor", position: null, found: false, rankingUrl: null, checkedAt: "now", searchEngine: "google", location: "Indianapolis" }, normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: 1000, checkedAt: "now" }));
    expect(opportunity.label).toBe("high_priority");
    expect(opportunity.score).toBeGreaterThan(70);
  });

  it("treats a top-three ranking as already strong", () => {
    const opportunity = opportunityForQuery({ query: "financial advisor Indianapolis", type: "discovery", service: "financial advisor", position: 2, found: true, rankingUrl: "https://example.com", checkedAt: "now", searchEngine: "google", location: "Indianapolis" }, normalizeDemand({ query: "financial advisor Indianapolis", searchVolume: 1000, checkedAt: "now" }));
    expect(opportunity.label).toBe("already_strong");
  });

  it("reuses valid cached demand without calling the provider", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await ensureSearchDemand({
      supabase: supabaseForDemand([demandRow("financial advisor", new Date().toISOString(), 500)]),
      intents: ["financial advisor"],
      auditId: "audit-cache-hit",
    });
    expect(result.get("financial advisor")?.monthlySearchVolume).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes stale demand in one batched provider request", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse([
      { keyword: "financial advisor", search_volume: 250, competition: 0.2, cpc: 3 },
    ]) as Response);
    const result = await ensureSearchDemand({
      supabase: supabaseForDemand([demandRow("financial advisor", "2020-01-01T00:00:00.000Z", 50)]),
      intents: ["financial advisor"],
      auditId: "audit-stale",
    });
    expect(result.get("financial advisor")?.monthlySearchVolume).toBe(250);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes missing demand and preserves an unavailable item when the provider omits it", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse([
      { keyword: "financial advisor", search_volume: 250, competition: 0.2, cpc: 3 },
    ]) as Response);
    const result = await ensureSearchDemand({
      supabase: supabaseForDemand([]),
      intents: ["financial advisor", "retirement planning"],
      auditId: "audit-mixed",
    });
    expect(result.get("financial advisor")?.monthlySearchVolume).toBe(250);
    expect(result.get("retirement planning")?.demandLevel).toBe("unavailable");
  });

  it("degrades safely when the demand provider fails", async () => {
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider unavailable"));
    const result = await ensureSearchDemand({
      supabase: supabaseForDemand([]),
      intents: ["financial advisor"],
      auditId: "audit-provider-failure",
    });
    expect(result.get("financial advisor")?.demandLevel).toBe("unavailable");
  });
});
