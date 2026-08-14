import type { SupabaseClient } from "@supabase/supabase-js";
import { KFK_DEMAND_SOURCE, KFS_DEMAND_SOURCE, persistSearchDemandMetrics } from "@/lib/audit/search-demand/client";
import { normalizeDemand, normalizeIntent } from "@/lib/audit/search-demand/normalize";
import type { GoogleAdsLocation } from "@/lib/audit/search-demand/location";
import type { SearchDemand } from "@/lib/audit/search-demand/types";
import { generateDiscoveryCandidates } from "@/lib/audit/search-visibility/query-generation";
import { MIN_DISCOVERY_QUERIES } from "@/lib/audit/search-visibility/scoring";
import type { SearchProfile } from "@/lib/audit/search-profiles";
import { fetchDiscoveryCache, persistDiscoveryCache } from "./cache";
import { evidenceSeedPhrases, extractWebsiteEvidence } from "./evidence";
import { classifyKeywordIdea, clusterKeyForKeyword } from "./filter";
import { fetchKeywordsForKeywords, fetchKeywordsForSite } from "./provider";
import { selectDiscoveryQueries, TARGET_DISCOVERY_QUERIES } from "./select";
import type { CachedDiscoveryCandidate, DiscoveryDiagnostics, DiscoveryResult, FilteredCandidate, KeywordIdea } from "./types";

function emptyDiagnostics(): DiscoveryDiagnostics {
  return {
    kfsRequestAttempted: false,
    kfsCacheHit: false,
    kfsProviderHttpStatus: null,
    kfsProviderTaskStatus: null,
    kfsResultCount: null,
    kfsEvidenceBackedCount: 0,
    kfkRequestAttempted: false,
    kfkResultCount: null,
    searchVolumeRequestAttempted: false,
    selectedQueryCount: 0,
    fallbackPath: "none",
    failureReason: null,
  };
}

function unavailableDemand(query: string): SearchDemand {
  return { query, monthlySearchVolume: null, competition: null, cpc: null, demandLevel: "unavailable", checkedAt: "" };
}

function filterIdeas(input: {
  ideas: KeywordIdea[];
  html: string | null;
  businessName: string | null;
  city: string | null;
  state: string | null;
}): FilteredCandidate[] {
  const evidence = extractWebsiteEvidence(input.html);
  const kept: FilteredCandidate[] = [];
  const seen = new Set<string>();
  for (const idea of input.ideas) {
    const classified = classifyKeywordIdea({ idea, evidence, businessName: input.businessName, city: input.city, state: input.state });
    if (!("candidate" in classified)) continue;
    if (seen.has(classified.candidate.keyword)) continue;
    seen.add(classified.candidate.keyword);
    kept.push(classified.candidate);
  }
  return kept;
}

function candidatesFromCache(rows: CachedDiscoveryCandidate[]): FilteredCandidate[] {
  const checkedAt = new Date().toISOString();
  return rows.filter((row) => row.relevanceTier === 1 || row.relevanceTier === 2 || row.relevanceTier === 3).map((row) => ({
    keyword: normalizeIntent(row.keyword),
    relevanceTier: row.relevanceTier,
    relevanceSource: row.relevanceSource,
    searchVolume: row.searchVolume,
    cpc: row.cpc,
    competition: row.competition,
    clusterKey: clusterKeyForKeyword(row.keyword),
    demand: normalizeDemand({ query: row.keyword, searchVolume: row.searchVolume, competition: row.competition, cpc: row.cpc, checkedAt }),
  }));
}

function cacheRowsFromCandidates(candidates: FilteredCandidate[]): CachedDiscoveryCandidate[] {
  return candidates.map((candidate) => ({
    keyword: candidate.keyword,
    relevanceTier: candidate.relevanceTier,
    relevanceSource: candidate.relevanceSource,
    searchVolume: candidate.searchVolume,
    cpc: candidate.cpc,
    competition: candidate.competition,
  }));
}

function fallbackCandidates(input: {
  html: string | null;
  businessName: string | null;
  businessTypeHint?: string | null;
  city: string | null;
  state: string | null;
  services: string[];
  profile: SearchProfile;
}): FilteredCandidate[] {
  const website = filterIdeas({
    ideas: evidenceSeedPhrases(extractWebsiteEvidence(input.html)).map((keyword) => ({
      keyword,
      searchVolume: null,
      cpc: null,
      competition: null,
      competitionIndex: null,
      isBrand: false,
    })),
    html: input.html,
    businessName: input.businessName,
    city: input.city,
    state: input.state,
  });
  return mergeCandidates(website, generateDiscoveryCandidates(input)
    .filter((query) => query.relevanceTier !== 4)
    .map((query) => {
      const keyword = normalizeIntent(query.service ?? query.query);
      return {
        keyword,
        relevanceTier: (query.relevanceTier === 1 || query.relevanceTier === 2 || query.relevanceTier === 3) ? query.relevanceTier : 3,
        relevanceSource: query.relevanceSource ?? "website_evidence",
        searchVolume: null,
        cpc: null,
        competition: null,
        clusterKey: clusterKeyForKeyword(keyword),
        demand: unavailableDemand(keyword),
      } satisfies FilteredCandidate;
    }));
}

function mergeCandidates(...groups: FilteredCandidate[][]): FilteredCandidate[] {
  const merged = new Map<string, FilteredCandidate>();
  for (const group of groups) {
    for (const candidate of group) {
      const existing = merged.get(candidate.keyword);
      if (!existing || candidate.relevanceTier < existing.relevanceTier) merged.set(candidate.keyword, candidate);
    }
  }
  return [...merged.values()];
}

async function persistDemandForCandidates(input: {
  supabase: SupabaseClient;
  candidates: FilteredCandidate[];
  googleAdsLocation: GoogleAdsLocation;
  source: string;
  auditId?: string;
}): Promise<Map<string, SearchDemand>> {
  if (!input.candidates.length) return new Map();
  return persistSearchDemandMetrics({
    supabase: input.supabase,
    items: input.candidates.map((candidate) => ({
      query: candidate.keyword,
      searchVolume: candidate.searchVolume,
      competition: candidate.competition,
      cpc: candidate.cpc,
    })),
    googleAdsLocation: input.googleAdsLocation,
    source: input.source,
    auditId: input.auditId,
  });
}

export async function discoverSearchQueries(input: {
  supabase: SupabaseClient;
  auditId: string;
  normalizedDomain: string;
  html: string | null;
  businessName: string | null;
  businessTypeHint?: string | null;
  city: string | null;
  state: string | null;
  googleAdsLocation: GoogleAdsLocation | null;
  profile: SearchProfile;
  services: string[];
}): Promise<DiscoveryResult> {
  const diagnostics = emptyDiagnostics();
  const evidence = extractWebsiteEvidence(input.html);
  const seeds = evidenceSeedPhrases(evidence);
  const location = input.googleAdsLocation;

  const finish = (candidates: FilteredCandidate[], fallbackPath: DiscoveryResult["diagnostics"]["fallbackPath"], demandByIntent?: Map<string, SearchDemand>): DiscoveryResult => {
    const selected = selectDiscoveryQueries(candidates, TARGET_DISCOVERY_QUERIES);
    diagnostics.selectedQueryCount = selected.length;
    diagnostics.fallbackPath = fallbackPath;
    diagnostics.kfsEvidenceBackedCount = Math.max(diagnostics.kfsEvidenceBackedCount, candidates.filter((candidate) => candidate.relevanceSource === "primary_service" || candidate.relevanceSource === "website_evidence").length);
    if (selected.length < MIN_DISCOVERY_QUERIES) {
      diagnostics.fallbackPath = "insufficient";
      diagnostics.failureReason = "insufficient_discovery_coverage";
    }
    const demand = demandByIntent ?? new Map(candidates.map((candidate) => [candidate.keyword, candidate.demand]));
    return { selected, demandByIntent: demand, diagnostics, evidenceBackedCount: diagnostics.kfsEvidenceBackedCount };
  };

  if (location) {
    try {
      const cached = await fetchDiscoveryCache({
        supabase: input.supabase,
        normalizedDomain: input.normalizedDomain,
        locationCode: location.locationCode,
      });
      if (cached && cached.candidates.length >= MIN_DISCOVERY_QUERIES) {
        diagnostics.kfsCacheHit = true;
        diagnostics.kfsResultCount = cached.providerResultCount;
        const candidates = candidatesFromCache(cached.candidates);
        diagnostics.kfsEvidenceBackedCount = candidates.length;
        const demandByIntent = await persistDemandForCandidates({
          supabase: input.supabase,
          candidates,
          googleAdsLocation: location,
          source: cached.source || KFS_DEMAND_SOURCE,
          auditId: input.auditId,
        }).catch(() => new Map(candidates.map((candidate) => [candidate.keyword, candidate.demand])));
        console.info("[audit/keyword-discovery] cache hit", { auditId: input.auditId, domain: input.normalizedDomain, locationCode: location.locationCode, candidates: candidates.length });
        return finish(candidates, "none", demandByIntent);
      }
    } catch (error) {
      console.warn("[audit/keyword-discovery] cache lookup failed", { auditId: input.auditId, error: error instanceof Error ? error.message : error });
    }

    diagnostics.kfsRequestAttempted = true;
    try {
      const kfs = await fetchKeywordsForSite({ target: input.normalizedDomain, locationCode: location.locationCode });
      diagnostics.kfsProviderHttpStatus = kfs.httpStatus;
      diagnostics.kfsProviderTaskStatus = kfs.taskStatus;
      diagnostics.kfsResultCount = kfs.resultCount;
      const kfsCandidates = filterIdeas({ ideas: kfs.ideas, html: input.html, businessName: input.businessName, city: input.city, state: input.state });
      diagnostics.kfsEvidenceBackedCount = kfsCandidates.length;
      console.info("[audit/keyword-discovery] KFS complete", { auditId: input.auditId, returned: kfs.resultCount, evidenceBacked: kfsCandidates.length });

      if (kfsCandidates.length >= MIN_DISCOVERY_QUERIES) {
        await persistDiscoveryCache({
          supabase: input.supabase,
          normalizedDomain: input.normalizedDomain,
          locationCode: location.locationCode,
          source: KFS_DEMAND_SOURCE,
          candidates: cacheRowsFromCandidates(kfsCandidates),
          providerResultCount: kfs.resultCount,
        }).catch((error) => console.warn("[audit/keyword-discovery] cache persist failed", { auditId: input.auditId, error: error instanceof Error ? error.message : error }));
        const demandByIntent = await persistDemandForCandidates({
          supabase: input.supabase,
          candidates: kfsCandidates,
          googleAdsLocation: location,
          source: KFS_DEMAND_SOURCE,
          auditId: input.auditId,
        }).catch(() => new Map(kfsCandidates.map((candidate) => [candidate.keyword, candidate.demand])));
        return finish(kfsCandidates, "none", demandByIntent);
      }

      diagnostics.kfkRequestAttempted = true;
      const kfkSeeds = [...new Set([...seeds, ...kfsCandidates.map((candidate) => candidate.keyword)])].slice(0, 20);
      const kfk = kfkSeeds.length
        ? await fetchKeywordsForKeywords({ keywords: kfkSeeds, locationCode: location.locationCode })
        : { ideas: [], httpStatus: 0, taskStatus: null, resultCount: 0 };
      diagnostics.kfkResultCount = kfk.resultCount;
      const kfkCandidates = filterIdeas({ ideas: kfk.ideas, html: input.html, businessName: input.businessName, city: input.city, state: input.state });
      const merged = mergeCandidates(kfsCandidates, kfkCandidates);
      if (merged.length >= MIN_DISCOVERY_QUERIES) {
        await persistDiscoveryCache({
          supabase: input.supabase,
          normalizedDomain: input.normalizedDomain,
          locationCode: location.locationCode,
          source: KFK_DEMAND_SOURCE,
          candidates: cacheRowsFromCandidates(merged),
          providerResultCount: (kfs.resultCount ?? 0) + (kfk.resultCount ?? 0),
        }).catch((error) => console.warn("[audit/keyword-discovery] cache persist failed", { auditId: input.auditId, error: error instanceof Error ? error.message : error }));
        const demandByIntent = await persistDemandForCandidates({
          supabase: input.supabase,
          candidates: merged,
          googleAdsLocation: location,
          source: KFK_DEMAND_SOURCE,
          auditId: input.auditId,
        }).catch(() => new Map(merged.map((candidate) => [candidate.keyword, candidate.demand])));
        return finish(merged, "keywords_for_keywords", demandByIntent);
      }

      const withFallback = mergeCandidates(merged, fallbackCandidates(input));
      return finish(withFallback, withFallback.length >= MIN_DISCOVERY_QUERIES ? "profile_or_website" : "insufficient");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Keyword discovery provider failed.";
      diagnostics.kfsProviderHttpStatus = typeof error === "object" && error && "httpStatus" in error ? Number((error as { httpStatus?: number }).httpStatus) : diagnostics.kfsProviderHttpStatus;
      diagnostics.kfsProviderTaskStatus = typeof error === "object" && error && "taskStatus" in error ? Number((error as { taskStatus?: number }).taskStatus) : diagnostics.kfsProviderTaskStatus;
      console.warn("[audit/keyword-discovery] provider failure", { auditId: input.auditId, error: message });
    }
  }

  if (location && !diagnostics.kfkRequestAttempted) {
    diagnostics.kfkRequestAttempted = true;
    try {
      const kfk = seeds.length
        ? await fetchKeywordsForKeywords({ keywords: seeds, locationCode: location.locationCode })
        : { ideas: [], httpStatus: 0, taskStatus: null, resultCount: 0 };
      diagnostics.kfkResultCount = kfk.resultCount;
      const kfkCandidates = filterIdeas({ ideas: kfk.ideas, html: input.html, businessName: input.businessName, city: input.city, state: input.state });
      if (kfkCandidates.length >= MIN_DISCOVERY_QUERIES) {
        await persistDiscoveryCache({
          supabase: input.supabase,
          normalizedDomain: input.normalizedDomain,
          locationCode: location.locationCode,
          source: KFK_DEMAND_SOURCE,
          candidates: cacheRowsFromCandidates(kfkCandidates),
          providerResultCount: kfk.resultCount,
        }).catch((error) => console.warn("[audit/keyword-discovery] cache persist failed", { auditId: input.auditId, error: error instanceof Error ? error.message : error }));
        const demandByIntent = await persistDemandForCandidates({
          supabase: input.supabase,
          candidates: kfkCandidates,
          googleAdsLocation: location,
          source: KFK_DEMAND_SOURCE,
          auditId: input.auditId,
        }).catch(() => new Map(kfkCandidates.map((candidate) => [candidate.keyword, candidate.demand])));
        return finish(kfkCandidates, "keywords_for_keywords", demandByIntent);
      }
      const withFallback = mergeCandidates(kfkCandidates, fallbackCandidates(input));
      return finish(withFallback, withFallback.length >= MIN_DISCOVERY_QUERIES ? "profile_or_website" : "insufficient");
    } catch (error) {
      console.warn("[audit/keyword-discovery] KFK failure", { auditId: input.auditId, error: error instanceof Error ? error.message : error });
    }
  }

  const fallback = fallbackCandidates(input);
  return finish(fallback, fallback.length >= MIN_DISCOVERY_QUERIES ? "profile_or_website" : "insufficient");
}

export { emptyDiagnostics as emptyDiscoveryDiagnostics };
