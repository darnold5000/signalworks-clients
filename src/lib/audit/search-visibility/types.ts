import type { SearchDemandDiagnostics } from "@/lib/audit/search-demand/types";

export type SearchQueryType = "branded" | "discovery";

export type DiscoveryFallbackPath = "none" | "keywords_for_keywords" | "profile_or_website" | "insufficient";

export type DiscoveryDiagnostics = {
  kfsRequestAttempted: boolean;
  kfsCacheHit: boolean;
  kfsProviderHttpStatus: number | null;
  kfsProviderTaskStatus: number | null;
  kfsResultCount: number | null;
  kfsEvidenceBackedCount: number;
  kfkRequestAttempted: boolean;
  kfkResultCount: number | null;
  searchVolumeRequestAttempted: boolean;
  selectedQueryCount: number;
  fallbackPath: DiscoveryFallbackPath;
  failureReason: string | null;
};

export type SearchVisibilityQuery = {
  query: string;
  type: SearchQueryType;
  service: string | null;
  relevanceTier?: 1 | 2 | 3 | 4;
  relevanceSource?: "primary_service" | "website_evidence" | "business_hint" | "profile_default" | "keywords_for_site" | "keywords_for_keywords" | "legacy_unknown";
};

export type SearchVisibilityResult = SearchVisibilityQuery & {
  position: number | null;
  found: boolean;
  rankingUrl: string | null;
  checkedAt: string;
  searchEngine: "google";
  location: string;
  enteredMarket?: string | null;
  resolvedLocationName?: string;
  locationCode?: number;
  auditedDomain?: string;
  auditedBusinessName?: string | null;
  resultDepth?: number;
  taskId?: string | null;
  screenshotStatus?: "not_requested" | "pending" | "available" | "unavailable" | "failed";
  screenshotStoragePath?: string | null;
  screenshotCreatedAt?: string | null;
  screenshotSourceTaskId?: string | null;
  screenshotUrl?: string | null;
  screenshotExpiresAt?: string | null;
  monthlySearchVolume?: number | null;
  competition?: number | null;
  cpc?: number | null;
  demandLevel?: "high" | "moderate" | "low" | "very_low" | "unavailable";
  demandCheckedAt?: string | null;
  opportunityScore?: number | null;
  opportunityLabel?: string | null;
  collectionStatus?: "succeeded" | "failed";
  collectionErrorCode?: string | null;
  collectionErrorMessage?: string | null;
  relevanceTier?: 1 | 2 | 3 | 4;
  relevanceSource?: "primary_service" | "website_evidence" | "business_hint" | "profile_default" | "keywords_for_site" | "keywords_for_keywords" | "legacy_unknown";
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
  enteredMarket?: string | null;
  locationCode?: number | null;
  auditedDomain?: string | null;
  resultDepth?: number;
  searchEngine?: "google";
  profileKey?: string | null;
  demandLocation?: {
    requested: string | null;
    canonical: string | null;
    status: "resolved" | "ambiguous" | "not_found" | "provider_error" | "unavailable";
    googleAdsLocationCode: number | null;
    googleAdsLocationName: string | null;
    error: string | null;
  };
  searchDemandDiagnostics?: SearchDemandDiagnostics;
  discoveryDiagnostics?: DiscoveryDiagnostics;
  diagnostics?: {
    failurePhase: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    successfulQueryCount: number;
    failedQueryCount: number;
  };
};
