import { extractHeadings, extractLinks } from "@/lib/audit/collectors/shared/html-parse";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { fetchGoogleOrganicResults } from "./client";
import { generateSearchQueries } from "./query-generation";
import { scoreSearchVisibility, scoreSearchVisibilityTypes } from "./scoring";
import type { SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";

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
  const locationName = city ? `${city}${state ? `, ${state}` : ""}, United States` : "United States";
  const queries = generateSearchQueries({ businessName: input.businessName, city: city ?? null, state: state ?? null, services });
  console.info("[audit/search-visibility] started", {
    auditId: input.auditId,
    normalizedDomain: normalizeHostname(input.normalizedUrl),
    businessName: input.businessName,
    city: city ?? null,
    state: state ?? null,
    generatedQueries: queries.length,
  });
  if (queries.length === 0) {
    return { status: "unavailable", score: null, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName, results: [], summary: null, errorMessage: "Location or relevant services were not available.", checkedAt: null };
  }

  const targetDomain = normalizeHostname(input.normalizedUrl);
  const results = await Promise.all(queries.map(async (query): Promise<SearchVisibilityResult> => {
    console.info("[audit/search-visibility] query", { auditId: input.auditId, query: query.query, type: query.type, location: locationName });
    let response;
    try {
      response = await fetchGoogleOrganicResults({ keyword: query.query, locationName });
    } catch (error) {
      if (locationName !== "United States") {
        try {
          response = await fetchGoogleOrganicResults({ keyword: query.query, locationName: "United States" });
        } catch {
          throw error;
        }
      } else {
        throw error;
      }
    }
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
    return { query: query.query, type: query.type, service: query.service, position: matchedPosition && matchedPosition <= 30 ? matchedPosition : null, found: Boolean(matchedPosition && matchedPosition <= 30), rankingUrl: match?.url ?? null, checkedAt, searchEngine: "google", location: locationName };
  }));
  const summary = scoreSearchVisibility(results);
  const typeScores = scoreSearchVisibilityTypes(results);
  console.info("[audit/search-visibility] completed", { auditId: input.auditId, normalizedRankingCount: results.filter((result) => result.found).length, searchVisibilityScore: summary.score, brandedScore: typeScores.branded, discoveryScore: typeScores.discovery });
  return { status: "completed", score: summary.score, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName, results, summary, checkedAt };
}
