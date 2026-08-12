import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { getSearchProfileByKey, selectLocalQueryTerms, selectSearchProfile, type SearchProfile } from "@/lib/audit/search-profiles";
import { fetchGoogleLocalResults } from "./client";
import { localBusinessMatches } from "./matching";
import { scoreLocalSearch } from "./scoring";
import type { LocalSearchSnapshot } from "./types";

export async function runLocalSearch(input: {
  auditId: string;
  normalizedUrl: string;
  businessName: string | null;
  businessTypeHint?: string | null;
  enteredMarket: string | null;
  city: string | null;
  state: string | null;
  locationCode: number;
  locationName: string;
  homepageText: string;
  discoveryQueries: Array<string | { query: string; relevanceTier?: 1 | 2 | 3 | 4 }>;
  profile?: SearchProfile | null;
  profileKey?: string | null;
}): Promise<LocalSearchSnapshot> {
  // Local intent must come from this audit's validated discovery queries. Do
  // not classify the business from arbitrary homepage copy: marketing text
  // can mention unrelated industries and must never import profile terms.
  const profile = input.profile ?? getSearchProfileByKey(input.profileKey) ?? selectSearchProfile({ businessName: input.businessName, businessTypeHint: input.businessTypeHint, services: input.discoveryQueries.map((item) => typeof item === "string" ? item : item.query) });
  console.info("[audit/local-search] started", { auditId: input.auditId, applicable: profile.applicable, profile: profile.key });
  if (!profile.applicable) return { status: "not_applicable", score: null, profileKey: profile.key, enteredMarket: input.enteredMarket, normalizedMarket: input.locationName, locationName: input.locationName, locationCode: input.locationCode, results: [], summary: null, checkedAt: null, auditedDomain: normalizeAuditUrl(input.normalizedUrl).normalizedDomain, resultDepth: 20, searchEngine: "google" };
  if (input.discoveryQueries.length === 0) {
    return { status: "not_measured", score: null, profileKey: profile.key, enteredMarket: input.enteredMarket, normalizedMarket: input.locationName, locationName: input.locationName, locationCode: input.locationCode, results: [], summary: null, errorMessage: "We couldn't identify enough reliable local customer searches to measure Google Maps visibility for this report.", checkedAt: null, auditedDomain: normalizeAuditUrl(input.normalizedUrl).normalizedDomain, resultDepth: 20, searchEngine: "google" };
  }
  const market = [input.city, input.state].filter(Boolean).join(" ").trim();
  const orderedTerms = selectLocalQueryTerms({ discoveryQueries: input.discoveryQueries, profile });
  const queries = [...new Set(orderedTerms.map((term) => term.toLowerCase().includes((input.city ?? "").toLowerCase()) || !market ? term : `${term} ${market}`))].slice(0, 5);
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
