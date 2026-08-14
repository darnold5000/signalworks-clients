import { containsBusinessName } from "@/lib/audit/search-visibility/query-generation";
import { normalizeDemand, normalizeIntent } from "@/lib/audit/search-demand/normalize";
import { AUDIENCE_MODIFIERS, FORMAT_MODIFIERS, QUALITY_JUNK, ROLE_MODIFIERS, stemToken, stemmedSet, tokenize, type WebsiteEvidence } from "./evidence";
import type { FilteredCandidate, KeywordIdea } from "./types";

const LOCATION_STOPWORDS = new Set(["united", "states"]);

function locationTokens(city: string | null, state: string | null): Set<string> {
  return stemmedSet([...(city ? tokenize(city) : []), ...(state ? tokenize(state) : []), ...LOCATION_STOPWORDS]);
}

function distinctiveTokens(keyword: string): string[] {
  return tokenize(keyword).filter((token) => !FORMAT_MODIFIERS.has(token) && !AUDIENCE_MODIFIERS.has(token) && !ROLE_MODIFIERS.has(token) && !QUALITY_JUNK.has(token));
}

export function clusterKeyForKeyword(keyword: string): string {
  const tokens = tokenize(keyword);
  const core = distinctiveTokens(keyword).map(stemToken).sort().join(" ");
  const audience = tokens.map(stemToken).find((token) => AUDIENCE_MODIFIERS.has(token) || [...AUDIENCE_MODIFIERS].map(stemToken).includes(token));
  return audience ? `${core}:${audience}` : core || stemToken(tokens[0] ?? keyword);
}

function hasBrandAnnotation(idea: KeywordIdea): boolean {
  return idea.isBrand;
}

export function classifyKeywordIdea(input: {
  idea: KeywordIdea;
  evidence: WebsiteEvidence;
  businessName: string | null;
  city: string | null;
  state: string | null;
}): { candidate: FilteredCandidate } | { rejectedReason: string } {
  const keyword = normalizeIntent(input.idea.keyword);
  if (!keyword || keyword.length < 3 || keyword.length > 80) return { rejectedReason: "invalid_keyword" };
  if (containsBusinessName(keyword, input.businessName) || hasBrandAnnotation(input.idea)) return { rejectedReason: "brand" };

  const tokens = tokenize(keyword);
  const location = locationTokens(input.city, input.state);
  if (tokens.some((token) => location.has(stemToken(token)))) return { rejectedReason: "location_appended" };
  if (/^(home|about|contact|privacy|terms|login|careers?|blog|news|menu)$/i.test(keyword)) return { rejectedReason: "navigational" };

  const evidenceStems = stemmedSet(input.evidence.allTokens);
  const primaryStems = stemmedSet(input.evidence.primaryTokens);
  const distinctive = distinctiveTokens(keyword).map(stemToken);
  if (!distinctive.length) return { rejectedReason: "modifiers_only" };

  const unsupported = distinctive.filter((token) => !evidenceStems.has(token));
  if (unsupported.length) return { rejectedReason: "unsupported_by_evidence" };

  const primaryHits = distinctive.filter((token) => primaryStems.has(token));
  const demand = normalizeDemand({
    query: keyword,
    searchVolume: input.idea.searchVolume,
    competition: input.idea.competitionIndex ?? input.idea.competition,
    cpc: input.idea.cpc,
    checkedAt: new Date().toISOString(),
  });
  const clusterKey = clusterKeyForKeyword(keyword);
  const base = {
    keyword,
    searchVolume: input.idea.searchVolume,
    cpc: input.idea.cpc,
    competition: input.idea.competitionIndex ?? input.idea.competition,
    clusterKey,
    demand,
  };

  if (primaryHits.length === distinctive.length && primaryHits.length > 0) {
    return { candidate: { ...base, relevanceTier: 1, relevanceSource: "primary_service" } };
  }
  if (primaryHits.length > 0) {
    return { candidate: { ...base, relevanceTier: 2, relevanceSource: "website_evidence" } };
  }
  return { candidate: { ...base, relevanceTier: 3, relevanceSource: "website_evidence" } };
}
