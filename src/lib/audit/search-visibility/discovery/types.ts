import type { SearchDemand } from "@/lib/audit/search-demand/types";
import type { DiscoveryDiagnostics, DiscoveryFallbackPath, SearchVisibilityQuery } from "@/lib/audit/search-visibility/types";

export type { DiscoveryDiagnostics, DiscoveryFallbackPath };

export type KeywordIdea = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionIndex: number | null;
  monthlySearches?: Array<{ year: number; month: number; search_volume: number | null }>;
  isBrand: boolean;
};

export type FilteredCandidate = {
  keyword: string;
  relevanceTier: 1 | 2 | 3;
  relevanceSource: SearchVisibilityQuery["relevanceSource"];
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  rejectedReason?: string;
  clusterKey: string;
  demand: SearchDemand;
};

export type CachedDiscoveryCandidate = {
  keyword: string;
  relevanceTier: 1 | 2 | 3;
  relevanceSource: SearchVisibilityQuery["relevanceSource"];
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  rejectedReason?: string;
};

export type DiscoveryResult = {
  selected: SearchVisibilityQuery[];
  demandByIntent: Map<string, SearchDemand>;
  diagnostics: DiscoveryDiagnostics;
  evidenceBackedCount: number;
};
