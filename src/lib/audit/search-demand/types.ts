export type DemandLevel = "high" | "moderate" | "low" | "very_low" | "unavailable";

export type SearchDemand = {
  query: string;
  monthlySearchVolume: number | null;
  competition: number | null;
  cpc: number | null;
  demandLevel: DemandLevel;
  checkedAt: string;
};
