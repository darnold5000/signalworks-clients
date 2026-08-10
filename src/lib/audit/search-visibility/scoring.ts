import type { SearchVisibilityResult, SearchVisibilitySummary } from "./types";

function visibilityValue(position: number | null) {
  if (position == null || position > 30) return 0;
  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position <= 5) return 85;
  if (position <= 10) return 75;
  if (position <= 15) return 55;
  if (position <= 20) return 40;
  return 20;
}

export function scoreSearchVisibilityTypes(results: SearchVisibilityResult[]) {
  const average = (items: SearchVisibilityResult[]) => items.length
    ? items.reduce((sum, item) => sum + visibilityValue(item.position), 0) / items.length
    : null;
  return {
    branded: average(results.filter((result) => result.type === "branded")),
    discovery: average(results.filter((result) => result.type === "discovery")),
  };
}

export function scoreSearchVisibility(results: SearchVisibilityResult[]): SearchVisibilitySummary {
  const discovery = results.filter((result) => result.type === "discovery");
  const branded = results.filter((result) => result.type === "branded");
  const { discovery: discoveryScore, branded: brandedScore } = scoreSearchVisibilityTypes(results);
  // Search visibility measures acquisition/search intent. Branded rankings are
  // reported separately and must not rescue weak discovery visibility.
  const score = Math.round(discoveryScore ?? 0);
  const found = discovery.filter((result) => result.position != null && result.position <= 30);
  const bestDiscovery = discovery.filter((result) => result.position != null).sort((a, b) => (a.position! - b.position!))[0] ?? null;
  return {
    score,
    discoveryScore,
    brandedScore,
    discoveryQueriesAnalyzed: discovery.length,
    brandedQueriesAnalyzed: branded.length,
    queriesAnalyzed: results.length,
    topThreeCount: found.filter((result) => result.position! <= 3).length,
    firstPageCount: found.filter((result) => result.position! <= 10).length,
    positions11To20Count: found.filter((result) => result.position! >= 11 && result.position! <= 20).length,
    positions21To30Count: found.filter((result) => result.position! >= 21 && result.position! <= 30).length,
    notFoundCount: results.filter((result) => result.position == null || result.position > 30).length,
    bestDiscoveryQuery: bestDiscovery?.query ?? null,
    bestDiscoveryPosition: bestDiscovery?.position ?? null,
  };
}
