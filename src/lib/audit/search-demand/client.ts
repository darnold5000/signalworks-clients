import type { SearchDemand } from "./types";
import { normalizeDemand } from "./normalize";

type DemandResponse = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ keyword?: string; search_volume?: number | null; competition?: number | null; cpc?: number | null }> }> };
const demandCache = new Map<string, { expiresAt: number; data: SearchDemand[] }>();
const DEMAND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function fetchSearchDemand(input: { keywords: string[]; locationName: string }): Promise<SearchDemand[]> {
  const cacheKey = `${input.locationName.toLowerCase()}:${[...input.keywords].map((keyword) => keyword.trim().toLowerCase()).sort().join("|")}`;
  const cached = demandCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DataForSEO credentials are not configured.");
  const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keywords: input.keywords, location_name: input.locationName, language_code: "en", search_partners: false }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO demand HTTP ${response.status}`);
  const payload = (await response.json()) as DemandResponse;
  const task = payload.tasks?.[0];
  if (payload.status_code !== 20000 || !task || task.status_code !== 20000) throw new Error(task?.status_message ?? payload.status_message ?? "DataForSEO demand failed.");
  const checkedAt = new Date().toISOString();
  const data = (task.result ?? []).map((result) => normalizeDemand({ query: result.keyword ?? "", searchVolume: result.search_volume, competition: result.competition, cpc: result.cpc, checkedAt }));
  demandCache.set(cacheKey, { expiresAt: Date.now() + DEMAND_CACHE_TTL_MS, data });
  return data;
}
