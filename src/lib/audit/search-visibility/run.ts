import { extractHeadings, extractLinks } from "@/lib/audit/collectors/shared/html-parse";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { fetchGoogleOrganicResults, resolveDataForSeoLocation } from "./client";
import { generateDiscoveryCandidates, generateSearchQueries } from "./query-generation";
import { scoreSearchVisibility, scoreSearchVisibilityTypes } from "./scoring";
import { fetchSearchDemand } from "@/lib/audit/search-demand/client";
import { opportunityForQuery } from "@/lib/audit/search-demand/opportunity";
import type { SearchDemand } from "@/lib/audit/search-demand/types";
import type { SearchVisibilityQuery, SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";

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
  city: string | null;
  fetchHomepage: () => Promise<{ bodyText: string } | null>;
}): Promise<SearchVisibilitySnapshot> {
  const checkedAt = new Date().toISOString();
  const homepage = await input.fetchHomepage();
  const services = homepage ? detectServices(homepage.bodyText) : [];
  const [city, state] = (input.city ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const detectedLocationName = city ? `${city}${state ? `, ${state}` : ""}, United States` : "United States";
  const enteredMarket = input.city;
  const fallbackQueries = generateSearchQueries({ businessName: input.businessName, city: city ?? null, state: state ?? null, services });
  console.info("[audit/search-visibility] started", {
    auditId: input.auditId,
    normalizedDomain: normalizeHostname(input.normalizedUrl),
    businessName: input.businessName,
    city: city ?? null,
    state: state ?? null,
    generatedQueries: fallbackQueries.length,
  });
  if (fallbackQueries.length === 0) {
    return { status: "unavailable", score: null, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName: detectedLocationName, results: [], summary: null, errorMessage: "Location or relevant services were not available.", checkedAt: null, enteredMarket, locationCode: null, auditedDomain: normalizeHostname(input.normalizedUrl), resultDepth: 30, searchEngine: "google" };
  }

  const resolvedLocation = await resolveDataForSeoLocation({ city: city ?? null, state: state ?? null });
  console.info("[audit/search-visibility] location resolved", {
    auditId: input.auditId,
    detectedLocation: detectedLocationName,
    resolvedLocation: resolvedLocation.locationName,
    locationCode: resolvedLocation.locationCode,
  });
  const candidates = generateDiscoveryCandidates({ businessName: input.businessName, city: city ?? null, state: state ?? null, services });
  let demandByQuery = new Map<string, SearchDemand>();
  let selectedDiscovery = fallbackQueries.filter((query) => query.type === "discovery");
  if (candidates.length > 0) {
    try {
      const demand = await fetchSearchDemand({ keywords: candidates.map((candidate) => candidate.query), locationName: resolvedLocation.locationName });
      demandByQuery = new Map(demand.map((item) => [item.query.toLowerCase(), item]));
      const demandRank = (query: SearchVisibilityQuery) => {
        const item = demandByQuery.get(query.query.toLowerCase());
        return item?.monthlySearchVolume ?? -1;
      };
      selectedDiscovery = [...candidates].sort((a, b) => demandRank(b) - demandRank(a)).slice(0, 8);
      console.info("[audit/search-visibility] demand selected", { auditId: input.auditId, candidates: candidates.length, selected: selectedDiscovery.length });
    } catch (error) {
      console.warn("[audit/search-visibility] demand unavailable; using existing discovery set", { auditId: input.auditId, error: error instanceof Error ? error.message : error });
    }
  }
  const queries = [...fallbackQueries.filter((query) => query.type === "branded"), ...selectedDiscovery].slice(0, 10);
  const targetDomain = normalizeHostname(input.normalizedUrl);
  const results = await Promise.all(queries.map(async (query): Promise<SearchVisibilityResult> => {
    console.info("[audit/search-visibility] query", { auditId: input.auditId, query: query.query, type: query.type, location: resolvedLocation.locationName, locationCode: resolvedLocation.locationCode });
    const response = await fetchGoogleOrganicResults({ keyword: query.query, locationCode: resolvedLocation.locationCode, locationName: resolvedLocation.locationName });
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
    const baseResult = { query: query.query, type: query.type, service: query.service, position: matchedPosition && matchedPosition <= 30 ? matchedPosition : null, found: Boolean(matchedPosition && matchedPosition <= 30), rankingUrl: match?.url ?? null, checkedAt, searchEngine: "google" as const, location: resolvedLocation.locationName, enteredMarket, resolvedLocationName: resolvedLocation.locationName, locationCode: resolvedLocation.locationCode, auditedDomain: targetDomain, auditedBusinessName: input.businessName, resultDepth: response.resultDepth, taskId: response.taskId };
    const demand = demandByQuery.get(query.query.toLowerCase());
    const opportunity = query.type === "discovery" ? opportunityForQuery(baseResult, demand) : null;
    return { ...baseResult, monthlySearchVolume: demand?.monthlySearchVolume ?? null, competition: demand?.competition ?? null, cpc: demand?.cpc ?? null, demandLevel: demand?.demandLevel ?? "unavailable", demandCheckedAt: demand?.checkedAt ?? null, opportunityScore: opportunity?.score ?? null, opportunityLabel: opportunity?.label ?? null };
  }));
  const summary = scoreSearchVisibility(results);
  const typeScores = scoreSearchVisibilityTypes(results);
  console.info("[audit/search-visibility] completed", { auditId: input.auditId, normalizedRankingCount: results.filter((result) => result.found).length, searchVisibilityScore: summary.score, brandedScore: typeScores.branded, discoveryScore: typeScores.discovery });
  return { status: "completed", score: summary.score, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName: resolvedLocation.locationName, results, summary, checkedAt, enteredMarket, locationCode: resolvedLocation.locationCode, auditedDomain: targetDomain, resultDepth: 30, searchEngine: "google" };
}
