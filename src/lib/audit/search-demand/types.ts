export type DemandLevel = "high" | "moderate" | "low" | "very_low" | "unavailable";

export type SearchDemand = {
  query: string;
  monthlySearchVolume: number | null;
  competition: number | null;
  cpc: number | null;
  demandLevel: DemandLevel;
  checkedAt: string;
};

export type DemandFailurePhase = "cache_lookup" | "provider_request" | "provider_response" | "provider_parse" | "demand_persistence";

export type SearchDemandDiagnostics = {
  providerRequestAttempted: boolean;
  providerHttpStatus: number | null;
  providerTaskStatus: number | null;
  responseStatus: "not_attempted" | "received" | "failed";
  parseStatus: "not_attempted" | "succeeded" | "failed";
  resultCount: number | null;
  persistenceAttempted: boolean;
  persistenceStatus: "not_attempted" | "succeeded" | "failed";
  failurePhase: DemandFailurePhase | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type SearchDemandResult = {
  demandByIntent: Map<string, SearchDemand>;
  diagnostics: SearchDemandDiagnostics;
};
