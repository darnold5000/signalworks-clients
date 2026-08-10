export type LocalSearchResult = {
  query: string;
  position: number | null;
  found: boolean;
  businessName: string | null;
  websiteDomain: string | null;
  resultUrl: string | null;
  location: string;
  checkedAt: string;
};

export type LocalSearchSummary = {
  score: number;
  queriesAnalyzed: number;
  foundCount: number;
  topThreeCount: number;
  topTenCount: number;
  notFoundCount: number;
  bestPosition: number | null;
  bestQuery: string | null;
  averagePosition: number | null;
};

export type LocalSearchSnapshot = {
  status: "completed" | "not_applicable" | "failed";
  score: number | null;
  profileKey: string | null;
  enteredMarket: string | null;
  normalizedMarket: string | null;
  locationName: string | null;
  locationCode: number | null;
  results: LocalSearchResult[];
  summary: LocalSearchSummary | null;
  errorMessage?: string | null;
  checkedAt: string | null;
};
