import { extractHeadings, extractLinks } from "@/lib/audit/collectors/shared/html-parse";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { fetchGoogleOrganicResults } from "./client";
import { generateSearchQueries } from "./query-generation";
import { scoreSearchVisibility } from "./scoring";
import type { SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";

function normalizeHostname(value: string) {
  return normalizeAuditUrl(value).normalizedDomain;
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
  if (queries.length === 0) {
    return { status: "unavailable", score: null, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName, results: [], summary: null, errorMessage: "Location or relevant services were not available.", checkedAt: null };
  }

  const targetDomain = normalizeHostname(input.normalizedUrl);
  const results = await Promise.all(queries.map(async (query): Promise<SearchVisibilityResult> => {
    let items;
    try {
      items = await fetchGoogleOrganicResults({ keyword: query.query, locationName });
    } catch (error) {
      if (locationName !== "United States") {
        try {
          items = await fetchGoogleOrganicResults({ keyword: query.query, locationName: "United States" });
        } catch {
          throw error;
        }
      } else {
        throw error;
      }
    }
    const match = items.find((item) => item.url && domainMatches(item.url, targetDomain));
    return { query: query.query, type: query.type, service: query.service, position: match?.rank_absolute && match.rank_absolute <= 30 ? match.rank_absolute : null, found: Boolean(match?.rank_absolute && match.rank_absolute <= 30), rankingUrl: match?.url ?? null, checkedAt, searchEngine: "google", location: locationName };
  }));
  return { status: "completed", score: scoreSearchVisibility(results).score, businessName: input.businessName, city: city ?? null, state: state ?? null, locationName, results, summary: scoreSearchVisibility(results), checkedAt };
}
