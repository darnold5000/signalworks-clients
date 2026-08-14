import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMAND_TTL_DAYS } from "@/lib/audit/search-demand/normalize";
import type { CachedDiscoveryCandidate } from "./types";

export const DISCOVERY_TTL_DAYS = Number(process.env.SEARCH_KEYWORD_DISCOVERY_TTL_DAYS ?? DEMAND_TTL_DAYS) || 90;

export type CachedDiscoveryRow = {
  source: string;
  candidates: CachedDiscoveryCandidate[];
  providerResultCount: number | null;
  checkedAt: string;
};

function isFresh(checkedAt: string) {
  const age = Date.now() - new Date(checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= DISCOVERY_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export async function fetchDiscoveryCache(input: {
  supabase: SupabaseClient;
  normalizedDomain: string;
  locationCode: number;
  languageCode?: string;
}): Promise<CachedDiscoveryRow | null> {
  const { data, error } = await input.supabase
    .from("search_keyword_discovery")
    .select("source, candidates_json, provider_result_count, checked_at")
    .eq("normalized_domain", input.normalizedDomain)
    .eq("location_code", input.locationCode)
    .eq("language_code", input.languageCode ?? "en")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.checked_at || !isFresh(data.checked_at)) return null;
  return {
    source: data.source,
    candidates: Array.isArray(data.candidates_json) ? data.candidates_json as CachedDiscoveryCandidate[] : [],
    providerResultCount: data.provider_result_count ?? null,
    checkedAt: data.checked_at,
  };
}

export async function persistDiscoveryCache(input: {
  supabase: SupabaseClient;
  normalizedDomain: string;
  locationCode: number;
  languageCode?: string;
  source: string;
  candidates: CachedDiscoveryCandidate[];
  providerResultCount: number | null;
}): Promise<void> {
  const checkedAt = new Date().toISOString();
  const { error } = await input.supabase.from("search_keyword_discovery").upsert({
    normalized_domain: input.normalizedDomain,
    location_code: input.locationCode,
    language_code: input.languageCode ?? "en",
    source: input.source,
    candidates_json: input.candidates,
    provider_result_count: input.providerResultCount,
    checked_at: checkedAt,
    updated_at: checkedAt,
  }, { onConflict: "normalized_domain,location_code,language_code" });
  if (error) throw new Error(error.message);
}
