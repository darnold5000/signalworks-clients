import { MIN_DISCOVERY_QUERIES } from "@/lib/audit/search-visibility/scoring";
import type { SearchVisibilityQuery } from "@/lib/audit/search-visibility/types";
import type { FilteredCandidate } from "./types";

export const TARGET_DISCOVERY_QUERIES = 6;
export const MAX_DISCOVERY_QUERIES = 8;

function demandRank(candidate: FilteredCandidate): number {
  return candidate.searchVolume ?? -1;
}

export function selectDiscoveryQueries(candidates: FilteredCandidate[], limit = TARGET_DISCOVERY_QUERIES): SearchVisibilityQuery[] {
  const cap = Math.min(MAX_DISCOVERY_QUERIES, Math.max(MIN_DISCOVERY_QUERIES, limit));
  const ranked = [...candidates].sort((left, right) => {
    if (left.relevanceTier !== right.relevanceTier) return left.relevanceTier - right.relevanceTier;
    return demandRank(right) - demandRank(left);
  });
  const selected: FilteredCandidate[] = [];
  const usedClusters = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= cap) break;
    if (usedClusters.has(candidate.clusterKey) && selected.length >= MIN_DISCOVERY_QUERIES) continue;
    if (usedClusters.has(candidate.clusterKey)) continue;
    selected.push(candidate);
    usedClusters.add(candidate.clusterKey);
  }

  if (selected.length < Math.max(MIN_DISCOVERY_QUERIES, cap) && selected.length < cap) {
    for (const candidate of ranked) {
      if (selected.length >= cap) break;
      if (selected.some((item) => item.keyword === candidate.keyword)) continue;
      if (usedClusters.has(candidate.clusterKey) && selected.length >= MIN_DISCOVERY_QUERIES) continue;
      selected.push(candidate);
      usedClusters.add(candidate.clusterKey);
    }
  }

  return selected.slice(0, cap).map((candidate) => ({
    query: candidate.keyword,
    type: "discovery",
    service: candidate.keyword,
    relevanceTier: candidate.relevanceTier,
    relevanceSource: candidate.relevanceSource,
  }));
}
