import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { selectLocalQueryTerms, selectSearchProfile } from "@/lib/audit/search-profiles";
import { fetchGoogleLocalResults } from "./client";
import { localBusinessMatches } from "./matching";
import { scoreLocalSearch } from "./scoring";
import type { LocalSearchSnapshot } from "./types";

export async function runLocalSearch(input: {
  auditId: string;
  normalizedUrl: string;
  businessName: string | null;
  enteredMarket: string | null;
  city: string | null;
  state: string | null;
  locationCode: number;
  locationName: string;
  homepageText: string;
  discoveryQueries: string[];
}): Promise<LocalSearchSnapshot> {
  const profile = selectSearchProfile({ businessName: input.businessName, services: input.discoveryQueries, content: input.homepageText });
  console.info("[audit/local-search] started", { auditId: input.auditId, applicable: profile.applicable, profile: profile.key });
  if (!profile.applicable) return { status: "not_applicable", score: null, profileKey: profile.key, enteredMarket: input.enteredMarket, normalizedMarket: input.locationName, locationName: input.locationName, locationCode: input.locationCode, results: [], summary: null, checkedAt: null, auditedDomain: normalizeAuditUrl(input.normalizedUrl).normalizedDomain, resultDepth: 20, searchEngine: "google" };
  const market = [input.city, input.state].filter(Boolean).join(" ").trim();
  const queries = [...new Set(selectLocalQueryTerms({ discoveryQueries: input.discoveryQueries, profile }).map((term) => term.toLowerCase().includes((input.city ?? "").toLowerCase()) || !market ? term : `${term} ${market}`))].slice(0, 5);
  const checkedAt = new Date().toISOString();
  const targetDomain = normalizeAuditUrl(input.normalizedUrl).normalizedDomain;
  const results = await Promise.all(queries.map(async (query) => {
    const response = await fetchGoogleLocalResults({ keyword: query, locationCode: input.locationCode, locationName: input.locationName });
    const match = response.items.find((item) => localBusinessMatches({ item, businessName: input.businessName, targetDomain }));
    const position = match?.rank_group ?? match?.rank_absolute ?? null;
    console.info("[audit/local-search] match", { auditId: input.auditId, query, matched: Boolean(match), position, businessName: match?.title ?? null, domain: match?.domain ?? null });
    return { query, queryType: "local" as const, position, found: position != null, businessName: match?.title ?? null, auditedBusinessName: input.businessName, websiteDomain: match?.domain ?? null, resultUrl: match?.url ?? null, location: input.locationName, checkedAt, searchEngine: "google" as const, enteredMarket: input.enteredMarket, resolvedLocationName: input.locationName, locationCode: input.locationCode, auditedDomain: targetDomain, resultDepth: response.resultDepth, taskId: response.taskId };
  }));
  const summary = scoreLocalSearch(results);
  console.info("[audit/local-search] completed", { auditId: input.auditId, score: summary.score, queries: results.length, found: summary.foundCount });
  return { status: "completed", score: summary.score, profileKey: profile.key, enteredMarket: input.enteredMarket, normalizedMarket: input.locationName, locationName: input.locationName, locationCode: input.locationCode, results, summary, checkedAt, auditedDomain: targetDomain, resultDepth: 20, searchEngine: "google" };
}
