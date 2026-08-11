import type { SearchDemand } from "./types";
import type { SearchVisibilityResult } from "@/lib/audit/search-visibility/types";

export type Opportunity = SearchDemand & { position: number | null; score: number | null; label: "high_priority" | "strong_opportunity" | "moderate_opportunity" | "low_priority" | "already_strong" | "unavailable" };

export function opportunityForQuery(result: SearchVisibilityResult, demand: SearchDemand | undefined): Opportunity {
  if (!demand || demand.monthlySearchVolume == null) return { query: result.query, monthlySearchVolume: null, competition: null, cpc: null, demandLevel: "unavailable", checkedAt: demand?.checkedAt ?? result.checkedAt, position: result.position, score: null, label: "unavailable" };
  const demandScore = demand.demandLevel === "high" ? 100 : demand.demandLevel === "moderate" ? 70 : demand.demandLevel === "low" ? 40 : 15;
  const gapScore = result.position == null ? 100 : result.position <= 3 ? 0 : result.position <= 10 ? 35 : result.position <= 20 ? 75 : 90;
  const score = Math.round(demandScore * 0.5 + gapScore * 0.4 + 80 * 0.1);
  const label = result.position != null && result.position <= 3 ? "already_strong" : score >= 70 ? "high_priority" : score >= 45 ? "strong_opportunity" : score >= 20 ? "moderate_opportunity" : "low_priority";
  return { ...demand, position: result.position, score, label };
}
