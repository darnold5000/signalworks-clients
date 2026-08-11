import type { DemandLevel, SearchDemand } from "./types";

export function demandLevelForVolume(volume: number | null): DemandLevel {
  if (volume == null) return "unavailable";
  if (volume >= 500) return "high";
  if (volume >= 100) return "moderate";
  if (volume >= 20) return "low";
  if (volume >= 1) return "very_low";
  return "very_low";
}

export function normalizeDemand(input: { query: string; searchVolume?: number | null; competition?: number | null; cpc?: number | null; checkedAt: string }): SearchDemand {
  return { query: input.query, monthlySearchVolume: input.searchVolume ?? null, competition: input.competition ?? null, cpc: input.cpc ?? null, demandLevel: demandLevelForVolume(input.searchVolume ?? null), checkedAt: input.checkedAt };
}
