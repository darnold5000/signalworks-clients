import type { DemandLevel, SearchDemand } from "./types";

export const DEMAND_TTL_DAYS = Number(process.env.SEARCH_INTENT_DEMAND_TTL_DAYS ?? 90) || 90;

export function normalizeIntent(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function demandIsFresh(demand: { checkedAt: string }) {
  if (!demand.checkedAt) return false;
  const age = Date.now() - new Date(demand.checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= DEMAND_TTL_DAYS * 24 * 60 * 60 * 1000;
}

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
