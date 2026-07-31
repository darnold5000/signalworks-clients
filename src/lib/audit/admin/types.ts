import type { AuditRunProgress } from "@/lib/audit/types";

export type AuditListItem = {
  runId: string;
  requestId: string;
  auditType: string;
  businessName: string | null;
  normalizedDomain: string;
  normalizedUrl: string;
  tenantId: string | null;
  tenantName: string | null;
  status: string;
  overallScore: number | null;
  previousScore: number | null;
  scoreChange: number | null;
  createdAt: string;
  completedAt: string | null;
  needsAttention: boolean;
};

export type AuditFindingRow = {
  id: string;
  category: string;
  checkKey: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  evidenceJson: Record<string, unknown>;
  sourceType: string;
  sourceLabel: string;
  isPublic: boolean;
  isClientVisible: boolean;
};

export type AuditScoreRow = {
  category: string;
  score: number;
  weight: number;
  findingCount: number;
};

export type AuditRecommendationRow = {
  id: string;
  recommendationKey: string;
  priority: string;
  title: string;
  description: string;
  impact: string | null;
  effort: string | null;
  signalworksServiceKey: string | null;
  supportingFindingKeys: string[];
  isPublic: boolean;
  isClientVisible: boolean;
  status: string;
};

export type AuditRunDetail = {
  runId: string;
  requestId: string;
  auditType: string;
  businessName: string | null;
  normalizedDomain: string;
  normalizedUrl: string;
  tenantId: string | null;
  tenantName: string | null;
  internalNotes: string | null;
  status: string;
  overallScore: number | null;
  summary: string | null;
  engineVersion: string;
  scopeVersion: string;
  createdAt: string;
  completedAt: string | null;
  progress: AuditRunProgress;
  findings: AuditFindingRow[];
  scores: AuditScoreRow[];
  recommendations: AuditRecommendationRow[];
  history: AuditHistoryComparison | null;
};

export type AuditHistoryComparison = {
  previousRunId: string | null;
  previousCompletedAt: string | null;
  overallScoreChange: number | null;
  categoryChanges: Array<{
    category: string;
    previousScore: number | null;
    currentScore: number;
    change: number | null;
  }>;
  newFindings: string[];
  resolvedFindings: string[];
  recurringFindings: string[];
};

export type ClientAuditSummary = {
  latestRunId: string | null;
  latestScore: number | null;
  previousScore: number | null;
  scoreChange: number | null;
  lastRunAt: string | null;
  highPriorityRecommendations: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
};
