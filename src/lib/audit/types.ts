import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import type { PageSpeedClient } from "@/lib/audit/collectors/pagespeed/client";
import type {
  AUDIT_RUN_STATUSES,
  AUDIT_TYPES,
  COLLECTOR_EXECUTION_STATUSES,
  COLLECTOR_PHASES,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  SOURCE_TYPES,
} from "@/lib/audit/constants";

export type AuditType = (typeof AUDIT_TYPES)[number];
export type AuditRunStatus = (typeof AUDIT_RUN_STATUSES)[number];
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type CollectorPhase = (typeof COLLECTOR_PHASES)[number];
export type CollectorExecutionStatus =
  (typeof COLLECTOR_EXECUTION_STATUSES)[number];

export type AuditScope = {
  auditType: AuditType;
  scopeVersion: string;
  includeOperationsInventory: boolean;
  includeEmailAuth: boolean;
  isPublicReport: boolean;
};

export type NormalizedAuditUrl = {
  input: string;
  normalizedUrl: string;
  normalizedDomain: string;
  hostname: string;
};

export type AuditFindingInput = {
  category: FindingCategory;
  checkKey: string;
  severity: FindingSeverity;
  status: FindingStatus;
  score?: number | null;
  title: string;
  summary: string;
  evidenceJson?: Record<string, unknown>;
  sourceType: SourceType;
  sourceLabel: string;
  isPublic?: boolean;
  isClientVisible?: boolean;
};

export type AuditCollectorResult = {
  collectorKey: string;
  findings: AuditFindingInput[];
  evidence?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

export type AuditCollectorServices = {
  url: NormalizedAuditUrl;
  fetchPage: SafeFetchFn;
  getHomepage: () => Promise<SafeFetchResponse | null>;
  primeHomepage: (response: SafeFetchResponse | null) => void;
  pagespeed: PageSpeedClient;
  loadTechnicalProfile: (tenantId: string) => Promise<TenantTechnicalProfile | null>;
};

export type AuditContext = {
  scope: AuditScope;
  url: NormalizedAuditUrl;
  tenantId: string | null;
  auditRequestId: string;
  auditRunId: string;
  services: AuditCollectorServices;
};

export type AuditCollector = {
  key: string;
  supports(scope: AuditScope): boolean;
  collect(context: AuditContext): Promise<AuditCollectorResult>;
};

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  userAgent?: string;
};

export type SafeFetchResponse = {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  redirectChain: string[];
};

export type SafeFetchFn = (
  url: string,
  options?: SafeFetchOptions,
) => Promise<SafeFetchResponse>;

export type CollectorProgressEntry = {
  status: CollectorExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type AuditRunScoringMetadata = {
  scoringVersion: string;
  weightSetVersion: string;
  recommendationCatalogVersion?: string | null;
  eligibleCategoryCount?: number;
  scoredCategoryCount?: number;
  unavailableCategories: string[];
  strengths: Array<{
    checkKey: string;
    category: string;
    title: string;
  }>;
  opportunities: Array<{
    checkKey: string;
    category: string;
    title: string;
    status: string;
  }>;
  scoringError?: string;
  recommendationError?: string;
};

export type AuditRunProgress = {
  phase: CollectorPhase;
  currentCollectorKey?: string;
  collectors: Record<string, CollectorProgressEntry>;
  updatedAt: string;
  scoring?: AuditRunScoringMetadata;
};

export type AuditRunOutcome = {
  runId: string;
  status: AuditRunStatus;
  overallScore: number | null;
  summary: string | null;
  findingCount: number;
  failedCollectors: string[];
};

export type RunAuditInput = {
  runId: string;
  requestId: string;
  tenantId: string | null;
  scope: AuditScope;
  url: NormalizedAuditUrl;
};

/** Persistence port — HTTP handlers and future queue workers implement this. */
export type AuditRunPersistence = {
  markRunning(runId: string): Promise<void>;
  saveProgress(runId: string, progress: AuditRunProgress): Promise<void>;
  saveCollectorFindings(
    runId: string,
    tenantId: string | null,
    result: AuditCollectorResult,
  ): Promise<void>;
  saveCategoryScores(
    runId: string,
    scores: import("@/lib/audit/scoring/score-audit").CategoryScoreResult[],
  ): Promise<void>;
  saveRecommendations(
    runId: string,
    recommendations: import("@/lib/audit/recommendations/generate").GeneratedRecommendation[],
  ): Promise<void>;
  completeRun(
    runId: string,
    input: {
      status: AuditRunStatus;
      overallScore: number | null;
      summary: string | null;
      progress: AuditRunProgress;
      errorCode?: string;
      errorMessageInternal?: string;
    },
  ): Promise<void>;
  markRequestStatus(
    requestId: string,
    status: "processing" | "completed" | "failed",
  ): Promise<void>;
};

export type RunAuditDependencies = {
  persistence: AuditRunPersistence;
  collectors: AuditCollector[];
  collectorServices?: AuditCollectorServices;
  now?: () => Date;
};
