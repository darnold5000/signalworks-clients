import type { AuditRunProgress } from "@/lib/audit/types";
import type { SearchVisibilityResult, SearchVisibilitySummary } from "@/lib/audit/search-visibility/types";

export type PublicAuditFinding = {
  category: string;
  checkKey: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  sourceLabel: string;
};

export type PublicAuditScore = {
  category: string;
  score: number;
  weight: number;
};

export type PublicAuditRecommendation = {
  recommendationKey: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  impact: string | null;
  effort: string | null;
  signalworksServiceKey: string | null;
};

export type PublicAuditDetail = {
  token: string;
  runId: string;
  status: string;
  businessName: string | null;
  normalizedDomain: string;
  normalizedUrl: string;
  overallScore: number | null;
  summary: string | null;
  completedAt: string | null;
  createdAt: string;
  progress: AuditRunProgress;
  scores: PublicAuditScore[];
  findings: PublicAuditFinding[];
  recommendations: PublicAuditRecommendation[];
  searchVisibility?: {
    status: "completed" | "unavailable" | "failed";
    score: number | null;
    locationName: string | null;
    results: SearchVisibilityResult[];
    summary: SearchVisibilitySummary | null;
  } | null;
};

export type PublicAuditRunResponse = {
  token: string;
  runId: string;
  status: string;
  overallScore: number | null;
  summary: string | null;
};
