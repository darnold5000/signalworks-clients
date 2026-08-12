import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchDemand, SearchDemandDiagnostics, SearchDemandResult } from "./types";
import { normalizeDemand } from "./normalize";
import type { GoogleAdsLocation } from "./location";

type DemandResponse = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result_count?: number; result?: Array<{ keyword?: string; search_volume?: number | null; competition?: number | null; competition_index?: number | null; cpc?: number | null; location_code?: number; language_code?: string }> }> };
const DEMAND_TTL_DAYS = Number(process.env.SEARCH_INTENT_DEMAND_TTL_DAYS ?? 90) || 90;

function normalizeIntent(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }

const demandIsFresh = (demand: SearchDemand) => {
  if (!demand.checkedAt) return false;
  const age = Date.now() - new Date(demand.checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= DEMAND_TTL_DAYS * 24 * 60 * 60 * 1000;
};

function unavailable(keyword: string): SearchDemand { return { query: keyword, monthlySearchVolume: null, competition: null, cpc: null, demandLevel: "unavailable", checkedAt: "" }; }

function emptyDiagnostics(): SearchDemandDiagnostics {
  return { providerRequestAttempted: false, providerHttpStatus: null, providerTaskStatus: null, responseStatus: "not_attempted", parseStatus: "not_attempted", resultCount: null, persistenceAttempted: false, persistenceStatus: "not_attempted", failurePhase: null, failureCode: null, failureMessage: null };
}

function failureDiagnostics(base: SearchDemandDiagnostics, input: { phase: SearchDemandDiagnostics["failurePhase"]; code: string; message: string }): SearchDemandDiagnostics {
  return { ...base, failurePhase: input.phase, failureCode: input.code, failureMessage: input.message };
}

/** Reads cached demand for the requested DataForSEO location only. It never calls DataForSEO. */
export async function fetchSearchDemand(input: { supabase: SupabaseClient; keywords: string[]; countryCode?: string; languageCode?: string; googleAdsLocation: GoogleAdsLocation }): Promise<SearchDemand[]> {
  const keywords = [...new Set(input.keywords.map(normalizeIntent).filter(Boolean))];
  if (!keywords.length) return [];
  const { data, error } = await input.supabase.from("search_intent_demand").select("normalized_intent, display_intent, monthly_search_volume, demand_level, competition, competition_index, cpc, checked_at").in("normalized_intent", keywords).eq("country_code", input.countryCode ?? "US").eq("language_code", input.languageCode ?? "en").eq("location_code", input.googleAdsLocation.locationCode);
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
  googleAdsLocation: GoogleAdsLocation;
}): Promise<SearchDemandResult> {
  const intents = [...new Set(input.intents.map(normalizeIntent).filter(Boolean))];
  const result = new Map<string, SearchDemand>();
  let diagnostics = emptyDiagnostics();
  if (!intents.length) return { demandByIntent: result, diagnostics };

  let cached: SearchDemand[] = [];
  try {
    cached = await fetchSearchDemand({
      supabase: input.supabase,
      keywords: intents,
      countryCode: input.countryCode,
      languageCode: input.languageCode,
      googleAdsLocation: input.googleAdsLocation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demand cache lookup failed.";
    diagnostics = failureDiagnostics(diagnostics, { phase: "cache_lookup", code: "demand_cache_lookup_failed", message });
    console.warn("[audit/search-demand] cache lookup failed", {
      auditId: input.auditId,
      failurePhase: diagnostics.failurePhase,
      failureCode: diagnostics.failureCode,
      error: message,
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
        auditId: input.auditId,
        countryCode: input.countryCode,
        languageCode: input.languageCode,
        googleAdsLocation: input.googleAdsLocation,
      });
      diagnostics = refreshed.diagnostics;
      refreshed.demand.forEach((demand, index) => {
        const intent = staleOrMissing[index] ?? normalizeIntent(demand.query);
        if (intent) result.set(intent, demand);
      });
      console.info("[audit/search-demand] refresh success", {
        auditId: input.auditId,
        requested: staleOrMissing.length,
        measured: refreshed.demand.filter((demand) => demand.monthlySearchVolume != null).length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search demand refresh failed.";
      const detailed = error && typeof error === "object" && "demandDiagnostics" in error
        ? (error as { demandDiagnostics?: SearchDemandDiagnostics }).demandDiagnostics
        : undefined;
      diagnostics = detailed ?? failureDiagnostics(diagnostics, { phase: "provider_request", code: "demand_refresh_failed", message });
      console.warn("[audit/search-demand] refresh failure", {
        auditId: input.auditId,
        requested: staleOrMissing.length,
        failurePhase: diagnostics.failurePhase,
        failureCode: diagnostics.failureCode,
        error: message,
      });
      for (const intent of staleOrMissing) {
        result.set(intent, cachedByIntent.get(intent) ?? unavailable(intent));
      }
    }
  }

  for (const intent of intents) {
    if (!result.has(intent)) result.set(intent, cachedByIntent.get(intent) ?? unavailable(intent));
  }
  return { demandByIntent: result, diagnostics };
}

/** Explicit platform/admin refresh. Visitor audits must not call this. */
export async function refreshSearchIntentDemand(input: { supabase: SupabaseClient; intents: string[]; auditId?: string; countryCode?: string; languageCode?: string; googleAdsLocation: GoogleAdsLocation }): Promise<{ demand: SearchDemand[]; diagnostics: SearchDemandDiagnostics }> {
  const keywords = [...new Set(input.intents.map(normalizeIntent).filter(Boolean))];
  let diagnostics = emptyDiagnostics();
  if (!keywords.length) return { demand: [], diagnostics };
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) {
    const message = "DataForSEO credentials are not configured.";
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics(diagnostics, { phase: "provider_request", code: "demand_credentials_missing", message }) });
  }
  const locationCode = input.googleAdsLocation.locationCode;
  const startedAt = Date.now();
  console.info("[audit/search-demand] provider request", {
    auditId: input.auditId,
    requested: keywords.length,
    locationCode,
    locationName: input.googleAdsLocation.locationName,
    languageCode: input.languageCode ?? "en",
  });
  diagnostics = { ...diagnostics, providerRequestAttempted: true };
  let response: Response;
  try {
    response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify([{ keywords, location_code: locationCode, language_code: input.languageCode ?? "en", search_partners: false }]), signal: AbortSignal.timeout(45_000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DataForSEO demand request failed.";
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics(diagnostics, { phase: "provider_request", code: "demand_provider_request_failed", message }) });
  }
  diagnostics = { ...diagnostics, providerHttpStatus: response.status, responseStatus: response.ok ? "received" : "failed" };
  if (!response.ok) {
    const message = `DataForSEO demand HTTP ${response.status}`;
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics(diagnostics, { phase: "provider_response", code: "demand_provider_http_error", message }) });
  }
  let payload: DemandResponse;
  try {
    payload = (await response.json()) as DemandResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DataForSEO demand response could not be parsed.";
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics({ ...diagnostics, parseStatus: "failed" }, { phase: "provider_parse", code: "demand_response_parse_failed", message }) });
  }
  const task = payload.tasks?.[0];
  diagnostics = { ...diagnostics, providerTaskStatus: task?.status_code ?? null, parseStatus: "succeeded" };
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) {
    const message = task?.status_message ?? payload.status_message ?? "DataForSEO demand failed.";
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics(diagnostics, { phase: "provider_response", code: "demand_provider_task_failed", message }) });
  }
  const providerResults = task.result ?? [];
  diagnostics = { ...diagnostics, resultCount: task.result_count ?? providerResults.length };
  const conflictingLocations = providerResults
    .map((result) => result.location_code)
    .filter((resultLocationCode): resultLocationCode is number => resultLocationCode != null && resultLocationCode !== locationCode);
  if (conflictingLocations.length) {
    const message = `DataForSEO demand response returned a different location code than requested (${[...new Set(conflictingLocations)].join(", ")}).`;
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics(diagnostics, { phase: "provider_parse", code: "demand_location_mismatch", message }) });
  }
  console.info("[audit/search-demand] provider response", {
    auditId: input.auditId,
    requested: keywords.length,
    returned: providerResults.length,
    resultCount: task.result_count ?? providerResults.length,
    measured: providerResults.filter((result) => result.search_volume != null).length,
    omitted: keywords.filter((keyword) => !providerResults.some((result) => normalizeIntent(result.keyword ?? "") === keyword)),
    locationCode: providerResults[0]?.location_code ?? locationCode,
    locationName: input.googleAdsLocation.locationName,
    languageCode: providerResults[0]?.language_code ?? input.languageCode ?? "en",
    durationMs: Date.now() - startedAt,
  });
  const checkedAt = new Date().toISOString();
  const measured = new Map(providerResults.map((result) => { const normalized = normalizeIntent(result.keyword ?? ""); return [normalized, normalizeDemand({ query: result.keyword ?? normalized, searchVolume: result.search_volume, competition: result.competition_index ?? result.competition, cpc: result.cpc, checkedAt })]; }));
  const rows = keywords.map((keyword) => { const item = measured.get(keyword) ?? unavailable(keyword); return { normalized_intent: keyword, display_intent: item.query, country_code: input.countryCode ?? "US", language_code: input.languageCode ?? "en", location_code: locationCode, location_name: input.googleAdsLocation.locationName, monthly_search_volume: item.monthlySearchVolume, demand_level: item.demandLevel, competition: item.competition, competition_index: item.competition, cpc: item.cpc, source: "dataforseo_google_ads", confidence: item.demandLevel === "unavailable" ? "unavailable" : "measured", checked_at: checkedAt, updated_at: checkedAt }; });
  diagnostics = { ...diagnostics, persistenceAttempted: true };
  const { error } = await input.supabase.from("search_intent_demand").upsert(rows, { onConflict: "normalized_intent,country_code,language_code,location_code" });
  if (error) {
    const message = error.message;
    console.warn("[audit/search-demand] persist failed", {
      auditId: input.auditId,
      requested: keywords.length,
      locationCode,
      locationName: input.googleAdsLocation.locationName,
      failurePhase: "demand_persistence",
      failureCode: "demand_persistence_failed",
      error: message,
    });
    throw Object.assign(new Error(message), { demandDiagnostics: failureDiagnostics({ ...diagnostics, persistenceStatus: "failed" }, { phase: "demand_persistence", code: "demand_persistence_failed", message }) });
  }
  diagnostics = { ...diagnostics, persistenceStatus: "succeeded" };
  console.info("[audit/search-demand] persist success", {
    auditId: input.auditId,
    requested: keywords.length,
    locationCode,
    locationName: input.googleAdsLocation.locationName,
    persisted: rows.length,
  });
  return { demand: keywords.map((keyword) => measured.get(keyword) ?? unavailable(keyword)), diagnostics };
}
