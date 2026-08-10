import type { LocalSearchResult, LocalSearchSummary } from "./types";

function value(position: number | null) {
  if (position == null) return 0;
  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position <= 5) return 80;
  if (position <= 10) return 65;
  if (position <= 20) return 40;
  return 0;
}

export function scoreLocalSearch(results: LocalSearchResult[]): LocalSearchSummary {
  const found = results.filter((result) => result.position != null);
  return {
    score: results.length ? Math.round(results.reduce((sum, result) => sum + value(result.position), 0) / results.length) : 0,
    queriesAnalyzed: results.length,
    foundCount: found.length,
    topThreeCount: found.filter((result) => result.position! <= 3).length,
    topTenCount: found.filter((result) => result.position! <= 10).length,
    notFoundCount: results.filter((result) => result.position == null).length,
    bestPosition: found.length ? Math.min(...found.map((result) => result.position!)) : null,
    bestQuery: found.sort((a, b) => a.position! - b.position!)[0]?.query ?? null,
    averagePosition: found.length ? Math.round((found.reduce((sum, result) => sum + result.position!, 0) / found.length) * 10) / 10 : null,
  };
}
