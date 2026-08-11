import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchDemand } from "./types";
import { normalizeDemand } from "./normalize";

type DemandResponse = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ keyword?: string; search_volume?: number | null; competition?: number | null; cpc?: number | null }> }> };
const DEMAND_TTL_DAYS = Number(process.env.SEARCH_INTENT_DEMAND_TTL_DAYS ?? 90) || 90;

function normalizeIntent(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }

function unavailable(keyword: string): SearchDemand { return { query: keyword, monthlySearchVolume: null, competition: null, cpc: null, demandLevel: "unavailable", checkedAt: "" }; }

/** Reads shared national demand only. It never calls DataForSEO. */
export async function fetchSearchDemand(input: { supabase: SupabaseClient; keywords: string[]; countryCode?: string; languageCode?: string }): Promise<SearchDemand[]> {
  const keywords = [...new Set(input.keywords.map(normalizeIntent).filter(Boolean))];
  if (!keywords.length) return [];
  const { data, error } = await input.supabase.from("search_intent_demand").select("normalized_intent, display_intent, monthly_search_volume, demand_level, competition, competition_index, cpc, checked_at").in("normalized_intent", keywords).eq("country_code", input.countryCode ?? "US").eq("language_code", input.languageCode ?? "en");
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

/** Explicit platform/admin refresh. Visitor audits must not call this. */
export async function refreshSearchIntentDemand(input: { supabase: SupabaseClient; intents: string[]; countryCode?: string; languageCode?: string }): Promise<SearchDemand[]> {
  const keywords = [...new Set(input.intents.map(normalizeIntent).filter(Boolean))];
  if (!keywords.length) return [];
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify([{ keywords, location_name: "United States", language_code: input.languageCode ?? "en", search_partners: false }]), signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`DataForSEO demand HTTP ${response.status}`);
  const payload = (await response.json()) as DemandResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO demand failed.");
  const checkedAt = new Date().toISOString();
  const measured = new Map((task.result ?? []).map((result) => { const normalized = normalizeIntent(result.keyword ?? ""); return [normalized, normalizeDemand({ query: result.keyword ?? normalized, searchVolume: result.search_volume, competition: result.competition, cpc: result.cpc, checkedAt })]; }));
  const rows = keywords.map((keyword) => { const item = measured.get(keyword) ?? unavailable(keyword); return { normalized_intent: keyword, display_intent: item.query, country_code: input.countryCode ?? "US", language_code: input.languageCode ?? "en", monthly_search_volume: item.monthlySearchVolume, demand_level: item.demandLevel, competition: item.competition, competition_index: item.competition, cpc: item.cpc, source: "dataforseo_google_ads", confidence: item.demandLevel === "unavailable" ? "unavailable" : "measured", checked_at: checkedAt, updated_at: checkedAt }; });
  const { error } = await input.supabase.from("search_intent_demand").upsert(rows, { onConflict: "normalized_intent,country_code,language_code" });
  if (error) throw new Error(error.message);
  return keywords.map((keyword) => measured.get(keyword) ?? unavailable(keyword));
}
