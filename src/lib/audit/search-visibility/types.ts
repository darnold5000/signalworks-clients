export type SearchQueryType = "branded" | "discovery";

export type SearchVisibilityQuery = {
  query: string;
  type: SearchQueryType;
  service: string | null;
};

export type SearchVisibilityResult = SearchVisibilityQuery & {
  position: number | null;
  found: boolean;
  rankingUrl: string | null;
  checkedAt: string;
  searchEngine: "google";
  location: string;
  monthlySearchVolume?: number | null;
  competition?: number | null;
  cpc?: number | null;
  demandLevel?: "high" | "moderate" | "low" | "very_low" | "unavailable";
  demandCheckedAt?: string | null;
  opportunityScore?: number | null;
  opportunityLabel?: string | null;
};

export type SearchVisibilitySummary = {
  score: number;
  discoveryScore: number | null;
  brandedScore: number | null;
  discoveryQueriesAnalyzed: number;
  brandedQueriesAnalyzed: number;
  queriesAnalyzed: number;
  topThreeCount: number;
  firstPageCount: number;
  positions11To20Count: number;
  positions21To30Count: number;
  notFoundCount: number;
  bestDiscoveryQuery: string | null;
  bestDiscoveryPosition: number | null;
};

export type SearchVisibilitySnapshot = {
  status: "completed" | "unavailable" | "failed";
  score: number | null;
  businessName: string | null;
  city: string | null;
  state: string | null;
  locationName: string | null;
  results: SearchVisibilityResult[];
  summary: SearchVisibilitySummary | null;
  errorMessage?: string | null;
  checkedAt: string | null;
};
