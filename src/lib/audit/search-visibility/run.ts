import { extractHeadings, extractLinks } from "@/lib/audit/collectors/shared/html-parse";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { fetchGoogleOrganicResults, resolveDataForSeoLocation } from "./client";
import { generateBrandedQueries } from "./query-generation";
import { discoverSearchQueries } from "./discovery";
import { hasSufficientDiscoveryCoverage, MIN_DISCOVERY_QUERIES, scoreSearchVisibility, scoreSearchVisibilityTypes } from "./scoring";
import { ensureSearchDemand } from "@/lib/audit/search-demand/client";
import { resolveGoogleAdsLocation } from "@/lib/audit/search-demand/location";
import { opportunityForQuery } from "@/lib/audit/search-demand/opportunity";
import { normalizeIntent } from "@/lib/audit/search-demand/normalize";
import type { SearchDemand, SearchDemandDiagnostics } from "@/lib/audit/search-demand/types";
import type { SearchVisibilityQuery, SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseMarketInput, parseCanonicalLocationName } from "@/lib/audit/location-input";
import { selectSearchProfile } from "@/lib/audit/search-profiles";

function normalizeHostname(value: string) {
  return normalizeAuditUrl(value).normalizedDomain;
}

function hostnameForLog(value: string | undefined, stripWww = false) {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return stripWww ? hostname.replace(/^www\./, "") : hostname;
  } catch {
    return null;
  }
}

export function selectRelevantDiscovery(candidates: SearchVisibilityQuery[], demandByQuery: Map<string, SearchDemand>, limit: number) {
  // Demand ranks opportunities only after primary-service coverage is held
  // aside. It must not decide what the business primarily does.
  const demandRank = (query: SearchVisibilityQuery) => demandByQuery.get((query.service ?? query.query).trim().toLowerCase())?.monthlySearchVolume ?? -1;
  const primary = candidates.filter((query) => query.relevanceTier === 1 || query.relevanceTier === 2).slice(0, limit);
  const remaining = candidates.filter((query) => !primary.includes(query)).sort((a, b) => demandRank(b) - demandRank(a));
  return [...primary, ...remaining].slice(0, limit);
}

export function selectOpportunityResults(results: SearchVisibilityResult[], limit: number) {
  const eligible = results.filter((result) => result.type === "discovery" && result.collectionStatus !== "failed" && result.opportunityScore != null);
  const rank = (result: SearchVisibilityResult) => {
    const tier = result.relevanceTier ?? 99;
    const authority = result.relevanceSource === "profile_default" ? 1 : 0;
    return { tier, authority, score: result.opportunityScore ?? -1 };
  };
  return [...eligible].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    if (left.authority !== right.authority) return left.authority - right.authority;
    if (left.tier !== right.tier) return left.tier - right.tier;
    return right.score - left.score;
  }).slice(0, limit);
}

export function domainMatches(rankingUrl: string, targetDomain: string) {
  try {
    const host = new URL(rankingUrl).hostname.toLowerCase().replace(/^www\./, "");
    return host === targetDomain || host.endsWith(`.${targetDomain}`);
  } catch {
    return false;
  }
}

function detectServices(html: string): string[] {
  const candidates = [
    ...extractHeadings(html, 1),
    ...extractHeadings(html, 2),
    ...extractHeadings(html, 3),
    ...extractLinks(html).filter((link) => /service|solution|offer|menu/i.test(`${link.href} ${link.text}`)).map((link) => link.text),
  ];
  const blocked = /^(home|about|contact|privacy|terms|learn more|read more|our services|services|menu)$/i;
  return [...new Set(candidates.map((value) => value.replace(/\s+/g, " ").trim()).filter((value) => value.length >= 4 && value.length <= 60 && !blocked.test(value)))].slice(0, 8);
}

export async function runSearchVisibility(input: {
  auditId: string;
  normalizedUrl: string;
  businessName: string | null;
  businessTypeHint?: string | null;
  city: string | null;
  fetchHomepage: () => Promise<{ bodyText: string } | null>;
  supabase: SupabaseClient;
}): Promise<SearchVisibilitySnapshot> {
  const checkedAt = new Date().toISOString();
  const homepage = await input.fetchHomepage();
  const services = homepage ? detectServices(homepage.bodyText) : [];
  const parsedMarket = parseMarketInput(input.city);
  const city = parsedMarket.city;
  const state = parsedMarket.state;
  const detectedLocationName = city ? `${city}${state ? `, ${state}` : ""}, United States` : "United States";
  const enteredMarket = input.city;
  const profile = selectSearchProfile({ businessName: input.businessName, businessTypeHint: input.businessTypeHint, services });
  const brandedQueries = generateBrandedQueries({ businessName: input.businessName, city: city ?? null, state: state ?? null });
  const targetDomain = normalizeHostname(input.normalizedUrl);
  console.info("[audit/search-visibility] started", {
    auditId: input.auditId,
    normalizedDomain: targetDomain,
    businessName: input.businessName,
    city: city ?? null,
    state: state ?? null,
    profile: profile.key,
    primaryService: profile.primaryService ?? null,
  });

  const serpResolution = await resolveDataForSeoLocation({ city, state, auditId: input.auditId });
  if (serpResolution.status !== "resolved") {
    const message = serpResolution.status === "ambiguous" ? `Please enter city and state. Multiple locations matched ${serpResolution.city}: ${serpResolution.candidates.join("; ")}.` : serpResolution.reason;
    return { status: "unavailable", score: null, businessName: input.businessName, city, state, locationName: detectedLocationName, results: [], summary: null, errorMessage: message, checkedAt: null, enteredMarket, locationCode: null, auditedDomain: targetDomain, resultDepth: 30, searchEngine: "google", profileKey: profile.key, diagnostics: serpResolution.status === "unavailable" && serpResolution.diagnostics ? { ...serpResolution.diagnostics, successfulQueryCount: 0, failedQueryCount: 0 } : undefined };
  }
  const serpLocation = serpResolution.location;
  const canonicalMarket = parseCanonicalLocationName(serpLocation.locationName);
  const googleAdsResolution = await resolveGoogleAdsLocation({ city: canonicalMarket.city, state: canonicalMarket.state, requestedMarket: input.city, auditId: input.auditId });
  const googleAdsLocation = googleAdsResolution.status === "resolved" ? googleAdsResolution.location : null;
  console.info("[audit/search-visibility] endpoint locations", { auditId: input.auditId, serpLocation, googleAdsLocation, googleAdsResolutionStatus: googleAdsResolution.status });
  console.info("[audit/search-visibility] location resolved", {
    auditId: input.auditId,
    detectedLocation: detectedLocationName,
    resolvedLocation: serpLocation.locationName,
    locationCode: serpLocation.locationCode,
  });

  const discovery = await discoverSearchQueries({
    supabase: input.supabase,
    auditId: input.auditId,
    normalizedDomain: targetDomain,
    html: homepage?.bodyText ?? null,
    businessName: input.businessName,
    businessTypeHint: input.businessTypeHint,
    city: city ?? null,
    state: state ?? null,
    googleAdsLocation,
    profile,
    services,
  });
  if (discovery.selected.length < MIN_DISCOVERY_QUERIES) {
    console.warn("[audit/search-visibility] insufficient discovery coverage", {
      auditId: input.auditId,
      selected: discovery.selected.length,
      fallbackPath: discovery.diagnostics.fallbackPath,
      kfsResultCount: discovery.diagnostics.kfsResultCount,
      evidenceBacked: discovery.diagnostics.kfsEvidenceBackedCount,
    });
    return {
      status: "unavailable",
      score: null,
      businessName: input.businessName,
      city: city ?? null,
      state: state ?? null,
      locationName: serpLocation.locationName,
      results: [],
      summary: null,
      errorMessage: "Not enough validated customer search intents were available to measure Search Visibility.",
      checkedAt: null,
      enteredMarket,
      locationCode: serpLocation.locationCode,
      auditedDomain: targetDomain,
      resultDepth: 30,
      searchEngine: "google",
      profileKey: profile.key,
      discoveryDiagnostics: discovery.diagnostics,
      diagnostics: {
        failurePhase: "search_visibility",
        failureCode: "insufficient_discovery_coverage",
        failureMessage: "The audit did not produce enough validated discovery searches.",
        successfulQueryCount: 0,
        failedQueryCount: 0,
      },
    };
  }

  let demandResolutionError: string | null = null;
  let searchDemandDiagnostics: SearchDemandDiagnostics = { providerRequestAttempted: false, providerHttpStatus: null, providerTaskStatus: null, responseStatus: "not_attempted", parseStatus: "not_attempted", resultCount: null, persistenceAttempted: false, persistenceStatus: "not_attempted", failurePhase: null, failureCode: null, failureMessage: null };
  const demandByQuery = new Map(discovery.demandByIntent);
  const missingDemand = discovery.selected
    .map((query) => normalizeIntent(query.service ?? query.query))
    .filter((intent) => {
      const demand = demandByQuery.get(intent);
      return !demand || !demand.checkedAt;
    });
  try {
    if (googleAdsLocation && missingDemand.length) {
      discovery.diagnostics.searchVolumeRequestAttempted = true;
      const demandResult = await ensureSearchDemand({ supabase: input.supabase, intents: missingDemand, auditId: input.auditId, googleAdsLocation });
      searchDemandDiagnostics = demandResult.diagnostics;
      demandResult.demandByIntent.forEach((demand, intent) => demandByQuery.set(intent, demand));
    }
  } catch (error) {
    demandResolutionError = error instanceof Error ? error.message : "Search demand could not be measured.";
    console.error("[audit/search-demand] unexpected failure; continuing with organic results", { auditId: input.auditId, phase: "search_demand", failureCode: "search_demand_unexpected_failure", error: demandResolutionError });
    searchDemandDiagnostics = { ...searchDemandDiagnostics, failurePhase: "provider_request", failureCode: "demand_unexpected_failure", failureMessage: demandResolutionError };
  }
  const demandLocation = { requested: input.city, canonical: serpLocation.locationName, status: demandResolutionError ? "provider_error" as const : googleAdsResolution.status, googleAdsLocationCode: googleAdsLocation?.locationCode ?? null, googleAdsLocationName: googleAdsLocation?.locationName ?? null, error: demandResolutionError ?? googleAdsResolution.error };
  const queries = [...brandedQueries, ...discovery.selected].slice(0, 10);
  console.info("[audit/search-visibility] discovery selected", {
    auditId: input.auditId,
    branded: brandedQueries.length,
    discovery: discovery.selected.length,
    fallbackPath: discovery.diagnostics.fallbackPath,
    kfsCacheHit: discovery.diagnostics.kfsCacheHit,
    searchVolumeRequestAttempted: discovery.diagnostics.searchVolumeRequestAttempted,
  });
  const results = await Promise.all(queries.map(async (query): Promise<SearchVisibilityResult> => {
    const demand = demandByQuery.get((query.service ?? query.query).trim().toLowerCase());
    try {
      console.info("[audit/search-visibility] query", { auditId: input.auditId, query: query.query, type: query.type, location: serpLocation.locationName, locationCode: serpLocation.locationCode });
      const response = await fetchGoogleOrganicResults({ keyword: query.query, locationCode: serpLocation.locationCode, locationName: serpLocation.locationName });
      const organicItems = response.items.filter((item) => item.type === "organic");
      const usableItems = organicItems.length > 0 ? organicItems : response.items.filter((item) => item.url && (item.rank_absolute != null || item.rank_group != null));
      const match = usableItems.find((item) => item.url && domainMatches(item.url, targetDomain));
      const matchedPosition = match?.rank_absolute ?? match?.rank_group ?? null;
      console.info("[audit/search-visibility] results", {
        auditId: input.auditId,
        query: query.query,
        resultObjects: response.resultCount,
        serpItems: response.items.length,
        organicItems: organicItems.length,
        itemTypes: response.itemTypes,
        matchedDomainResults: match ? 1 : 0,
        matchedResultHostname: hostnameForLog(match?.url),
        matchedResultNormalizedHostname: hostnameForLog(match?.url, true),
        matched: Boolean(match),
        matchedPosition,
      });
      const baseResult = { query: query.query, type: query.type, service: query.service, relevanceTier: query.relevanceTier, relevanceSource: query.relevanceSource, position: matchedPosition && matchedPosition <= 30 ? matchedPosition : null, found: Boolean(matchedPosition && matchedPosition <= 30), rankingUrl: match?.url ?? null, checkedAt, searchEngine: "google" as const, location: serpLocation.locationName, enteredMarket, resolvedLocationName: serpLocation.locationName, locationCode: serpLocation.locationCode, auditedDomain: targetDomain, auditedBusinessName: input.businessName, resultDepth: response.resultDepth, taskId: response.taskId, collectionStatus: "succeeded" as const };
      const opportunity = query.type === "discovery" ? opportunityForQuery(baseResult, demand) : null;
      return { ...baseResult, monthlySearchVolume: demand?.monthlySearchVolume ?? null, competition: demand?.competition ?? null, cpc: demand?.cpc ?? null, demandLevel: demand?.demandLevel ?? "unavailable", demandCheckedAt: demand?.checkedAt ?? null, opportunityScore: opportunity?.score ?? null, opportunityLabel: opportunity?.label ?? null };
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Organic search provider failed.";
      console.error("[audit/search-visibility] organic query failed", { auditId: input.auditId, phase: "organic_serp", failureCode: "organic_query_failed", query: query.query, locationCode: serpLocation.locationCode, error: failureMessage });
      return {
        query: query.query,
        type: query.type,
        service: query.service,
        relevanceTier: query.relevanceTier,
        relevanceSource: query.relevanceSource,
        position: null,
        found: false,
        rankingUrl: null,
        checkedAt,
        searchEngine: "google",
        location: serpLocation.locationName,
        enteredMarket,
        resolvedLocationName: serpLocation.locationName,
        locationCode: serpLocation.locationCode,
        auditedDomain: targetDomain,
        auditedBusinessName: input.businessName,
        resultDepth: 30,
        taskId: null,
        collectionStatus: "failed",
        collectionErrorCode: "organic_query_failed",
        collectionErrorMessage: failureMessage,
        monthlySearchVolume: demand?.monthlySearchVolume ?? null,
        competition: demand?.competition ?? null,
        cpc: demand?.cpc ?? null,
        demandLevel: demand?.demandLevel ?? "unavailable",
        demandCheckedAt: demand?.checkedAt ?? null,
        opportunityScore: null,
        opportunityLabel: null,
      };
    }
  }));
  const summary = scoreSearchVisibility(results);
  const successfulQueryCount = results.filter((result) => result.collectionStatus !== "failed").length;
  const failedQueryCount = results.filter((result) => result.collectionStatus === "failed").length;
  const diagnostics = {
    failurePhase: failedQueryCount > 0 ? "organic_serp" : null,
    failureCode: failedQueryCount > 0 ? "organic_query_partial_failure" : null,
    failureMessage: failedQueryCount > 0 ? `${failedQueryCount} organic search quer${failedQueryCount === 1 ? "y" : "ies"} failed; ${successfulQueryCount} succeeded.` : null,
    successfulQueryCount,
    failedQueryCount,
  };
  if (!hasSufficientDiscoveryCoverage(results)) {
    return { status: "unavailable", score: null, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName: serpLocation.locationName, results, summary: null, errorMessage: "Not enough validated customer search intents were measured.", checkedAt, enteredMarket, locationCode: serpLocation.locationCode, auditedDomain: targetDomain, resultDepth: 30, searchEngine: "google", profileKey: profile.key, demandLocation, searchDemandDiagnostics, discoveryDiagnostics: discovery.diagnostics, diagnostics: { ...diagnostics, failurePhase: failedQueryCount > 0 ? "organic_serp" : "search_visibility", failureCode: failedQueryCount > 0 ? "organic_insufficient_coverage" : "insufficient_discovery_coverage", failureMessage: failedQueryCount > 0 ? `${failedQueryCount} organic search quer${failedQueryCount === 1 ? "y" : "ies"} failed; only ${successfulQueryCount} succeeded.` : "The audit did not produce enough validated discovery searches." } };
  }
  const typeScores = scoreSearchVisibilityTypes(results);
  console.info("[audit/search-visibility] completed", { auditId: input.auditId, normalizedRankingCount: results.filter((result) => result.found).length, searchVisibilityScore: summary.score, brandedScore: typeScores.branded, discoveryScore: typeScores.discovery });
  return { status: "completed", score: summary.score, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName: serpLocation.locationName, results, summary, checkedAt, enteredMarket, locationCode: serpLocation.locationCode, auditedDomain: targetDomain, resultDepth: 30, searchEngine: "google", profileKey: profile.key, demandLocation, searchDemandDiagnostics, discoveryDiagnostics: discovery.diagnostics, diagnostics };
}
