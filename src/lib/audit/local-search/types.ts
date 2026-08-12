export type LocalSearchResult = {
  query: string;
  queryType?: "local";
  position: number | null;
  found: boolean;
  businessName: string | null;
  websiteDomain: string | null;
  resultUrl: string | null;
  location: string;
  checkedAt: string;
  searchEngine?: "google";
  enteredMarket?: string | null;
  resolvedLocationName?: string;
  locationCode?: number;
  auditedDomain?: string;
  auditedBusinessName?: string | null;
  resultDepth?: number;
  taskId?: string | null;
  screenshotUrl?: string | null;
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
  status: "completed" | "not_applicable" | "not_measured" | "failed";
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
  auditedDomain?: string | null;
  resultDepth?: number;
  searchEngine?: "google";
};
