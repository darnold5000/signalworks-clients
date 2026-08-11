import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchDemand } from "./types";
import { normalizeDemand } from "./normalize";

type DemandResponse = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result_count?: number; result?: Array<{ keyword?: string; search_volume?: number | null; competition?: number | null; competition_index?: number | null; cpc?: number | null; location_code?: number; language_code?: string }> }> };
const DEMAND_TTL_DAYS = Number(process.env.SEARCH_INTENT_DEMAND_TTL_DAYS ?? 90) || 90;

function normalizeIntent(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }

const demandIsFresh = (demand: SearchDemand) => {
  if (!demand.checkedAt) return false;
  const age = Date.now() - new Date(demand.checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= DEMAND_TTL_DAYS * 24 * 60 * 60 * 1000;
};

function unavailable(keyword: string): SearchDemand { return { query: keyword, monthlySearchVolume: null, competition: null, cpc: null, demandLevel: "unavailable", checkedAt: "" }; }

/** Reads cached demand for the requested DataForSEO location only. It never calls DataForSEO. */
export async function fetchSearchDemand(input: { supabase: SupabaseClient; keywords: string[]; countryCode?: string; languageCode?: string; locationCode?: number; locationName?: string }): Promise<SearchDemand[]> {
  const keywords = [...new Set(input.keywords.map(normalizeIntent).filter(Boolean))];
  if (!keywords.length) return [];
  const locationCode = input.locationCode ?? 2840;
  const { data, error } = await input.supabase.from("search_intent_demand").select("normalized_intent, display_intent, monthly_search_volume, demand_level, competition, competition_index, cpc, checked_at").in("normalized_intent", keywords).eq("country_code", input.countryCode ?? "US").eq("language_code", input.languageCode ?? "en").eq("location_code", locationCode);
  if (error) throw new Error(error.message);
  const rows = new Map((data ?? []).map((row) => [row.normalized_intent, row]));
  return keywords.map((keyword) => {
    const row = rows.get(keyword);
    if (!row) return unavailable(keyword);
    const age = Date.now() - new Date(row.checked_at).getTime();
    if (!Number.isFinite(age) || age > DEMAND_TTL_DAYS * 24 * 60 * 60 * 1000) return { ...unavailable(keyword), checkedAt: row.checked_at };
    return { query: row.display_intent ?? keyword, monthlySearchVolume: row.monthly_search_volume == null ? null : Number(row.monthly_search_volume), competition: row.competition_index == null ? row.competition : Number(row.competition_index), cpc: row.cpc == null ? null : Number(row.cpc), demandLevel: row.demand_level ?? "unavailable", checkedAt: row.checked_at };
  });
}

/**
 * Returns demand for discovery intents, refreshing only missing or stale cache
 * entries. A single refresh request is used for the whole batch so one audit
 * does not create duplicate provider calls for the same intent.
 */
export async function ensureSearchDemand(input: {
  supabase: SupabaseClient;
  intents: string[];
  auditId?: string;
  countryCode?: string;
  languageCode?: string;
  locationCode?: number;
  locationName?: string;
}): Promise<Map<string, SearchDemand>> {
  const intents = [...new Set(input.intents.map(normalizeIntent).filter(Boolean))];
  const result = new Map<string, SearchDemand>();
  if (!intents.length) return result;

  let cached: SearchDemand[] = [];
  try {
    cached = await fetchSearchDemand({
      supabase: input.supabase,
      keywords: intents,
      countryCode: input.countryCode,
      languageCode: input.languageCode,
      locationCode: input.locationCode,
      locationName: input.locationName,
    });
  } catch (error) {
    console.warn("[audit/search-demand] cache lookup failed", {
      auditId: input.auditId,
      error: error instanceof Error ? error.message : error,
    });
  }

  const cachedByIntent = new Map<string, SearchDemand>();
  cached.forEach((demand, index) => cachedByIntent.set(intents[index] ?? normalizeIntent(demand.query), demand));

  const staleOrMissing = intents.filter((intent) => {
    const demand = cachedByIntent.get(intent);
    if (demand && demandIsFresh(demand)) {
      console.info("[audit/search-demand] cache hit", { auditId: input.auditId, intent });
      result.set(intent, demand);
      return false;
    }
    console.info("[audit/search-demand] cache miss", {
      auditId: input.auditId,
      intent,
      reason: demand ? "stale" : "missing",
    });
    return true;
  });

  if (staleOrMissing.length) {
    try {
      const refreshed = await refreshSearchIntentDemand({
        supabase: input.supabase,
        intents: staleOrMissing,
        countryCode: input.countryCode,
        languageCode: input.languageCode,
        locationCode: input.locationCode,
        locationName: input.locationName,
      });
      refreshed.forEach((demand, index) => {
        const intent = staleOrMissing[index] ?? normalizeIntent(demand.query);
        if (intent) result.set(intent, demand);
      });
      console.info("[audit/search-demand] refresh success", {
        auditId: input.auditId,
        requested: staleOrMissing.length,
        measured: refreshed.filter((demand) => demand.monthlySearchVolume != null).length,
      });
    } catch (error) {
      console.warn("[audit/search-demand] refresh failure", {
        auditId: input.auditId,
        requested: staleOrMissing.length,
        error: error instanceof Error ? error.message : error,
      });
      for (const intent of staleOrMissing) {
        result.set(intent, cachedByIntent.get(intent) ?? unavailable(intent));
      }
    }
  }

  for (const intent of intents) {
    if (!result.has(intent)) result.set(intent, cachedByIntent.get(intent) ?? unavailable(intent));
  }
  return result;
}

/** Explicit platform/admin refresh. Visitor audits must not call this. */
export async function refreshSearchIntentDemand(input: { supabase: SupabaseClient; intents: string[]; countryCode?: string; languageCode?: string; locationCode?: number; locationName?: string }): Promise<SearchDemand[]> {
  const keywords = [...new Set(input.intents.map(normalizeIntent).filter(Boolean))];
  if (!keywords.length) return [];
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const locationCode = input.locationCode ?? 2840;
  const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify([{ keywords, location_code: locationCode, language_code: input.languageCode ?? "en", search_partners: false }]), signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`DataForSEO demand HTTP ${response.status}`);
  const payload = (await response.json()) as DemandResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO demand failed.");
  const providerResults = task.result ?? [];
  console.info("[audit/search-demand] provider response", {
    requested: keywords.length,
    returned: providerResults.length,
    resultCount: task.result_count ?? providerResults.length,
    measured: providerResults.filter((result) => result.search_volume != null).length,
    omitted: keywords.filter((keyword) => !providerResults.some((result) => normalizeIntent(result.keyword ?? "") === keyword)),
    locationCode: providerResults[0]?.location_code ?? 2840,
    locationName: input.locationName ?? (locationCode === 2840 ? "United States" : null),
    languageCode: providerResults[0]?.language_code ?? input.languageCode ?? "en",
  });
  const checkedAt = new Date().toISOString();
  const measured = new Map(providerResults.map((result) => { const normalized = normalizeIntent(result.keyword ?? ""); return [normalized, normalizeDemand({ query: result.keyword ?? normalized, searchVolume: result.search_volume, competition: result.competition_index ?? result.competition, cpc: result.cpc, checkedAt })]; }));
  const rows = keywords.map((keyword) => { const item = measured.get(keyword) ?? unavailable(keyword); return { normalized_intent: keyword, display_intent: item.query, country_code: input.countryCode ?? "US", language_code: input.languageCode ?? "en", location_code: locationCode, location_name: input.locationName ?? (locationCode === 2840 ? "United States" : null), monthly_search_volume: item.monthlySearchVolume, demand_level: item.demandLevel, competition: item.competition, competition_index: item.competition, cpc: item.cpc, source: "dataforseo_google_ads", confidence: item.demandLevel === "unavailable" ? "unavailable" : "measured", checked_at: checkedAt, updated_at: checkedAt }; });
  const { error } = await input.supabase.from("search_intent_demand").upsert(rows, { onConflict: "normalized_intent,country_code,language_code,location_code" });
  if (error) throw new Error(error.message);
  return keywords.map((keyword) => measured.get(keyword) ?? unavailable(keyword));
}
