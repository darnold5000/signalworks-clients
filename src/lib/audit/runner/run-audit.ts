import { AUDIT_ENGINE_VERSION } from "@/lib/audit/constants";
import { createCollectorServices } from "@/lib/audit/collectors/services";
import { generateRecommendations } from "@/lib/audit/recommendations/generate";
import {
  countFailedCollectors,
  createInitialProgress,
  resolveRunStatus,
  withPhase,
} from "@/lib/audit/runner/progress";
import { runCollectorsWithConcurrency } from "@/lib/audit/runner/run-collectors";
import {
  scoreAuditFindings,
  summarizeScore,
} from "@/lib/audit/scoring/score-audit";
import { createSafeFetch } from "@/lib/audit/url/safe-fetch";
import type {
  AuditCollector,
  AuditFindingInput,
  AuditRunOutcome,
  RunAuditDependencies,
  RunAuditInput,
} from "@/lib/audit/types";

/**
 * Stateless audit orchestrator. All mutable state is written through
 * `persistence` so the same function can run inside an HTTP request today
 * or a queue worker later.
 */
export async function runAudit(
  input: RunAuditInput,
  deps: RunAuditDependencies,
): Promise<AuditRunOutcome> {
  const now = deps.now ?? (() => new Date());
  const applicableCollectors = deps.collectors.filter((collector) =>
    collector.supports(input.scope),
  );
  const collectorKeys = applicableCollectors.map((collector) => collector.key);

  let progress = createInitialProgress(collectorKeys, now());
  const collectedFindings: AuditFindingInput[] = [];
  let fatalError = false;
  let errorCode: string | undefined;
  let errorMessageInternal: string | undefined;
  let overallScore: number | null = null;
  let summary: string | null = null;
  let scoringFailed = false;
  let recommendationsFailed = false;

  await deps.persistence.markRequestStatus(input.requestId, "processing");
  await deps.persistence.markRunning(input.runId);
  progress = withPhase(progress, "collecting", now());
  await deps.persistence.saveProgress(input.runId, progress);

  const services =
    deps.collectorServices ??
    createCollectorServices({
      url: input.url,
      fetchPage: createSafeFetch(),
    });

  const context = {
    scope: input.scope,
    url: input.url,
    tenantId: input.tenantId,
    auditRequestId: input.requestId,
    auditRunId: input.runId,
    services,
    businessName: input.businessName ?? null,
    market: input.market ?? null,
  };

  await runCollectorsWithConcurrency(applicableCollectors, {
    context,
    runId: input.runId,
    tenantId: input.tenantId,
    persistence: deps.persistence,
    now,
    onFindings: (findings) => {
      collectedFindings.push(...findings);
    },
    getProgress: () => progress,
    setProgress: (next) => {
      progress = next;
    },
  });

  progress = withPhase(progress, "scoring", now());
  await deps.persistence.saveProgress(input.runId, progress);

  let scoringResult;
  try {
    scoringResult = scoreAuditFindings(collectedFindings, input.scope);
    overallScore = scoringResult.overallScore;
    summary = summarizeScore(scoringResult);
    await deps.persistence.saveCategoryScores(
      input.runId,
      scoringResult.categoryScores,
    );
    progress = {
      ...progress,
      scoring: {
        scoringVersion: scoringResult.scoringVersion,
        weightSetVersion: scoringResult.weightSetVersion,
        eligibleCategoryCount: scoringResult.eligibleCategoryCount,
        scoredCategoryCount: scoringResult.scoredCategoryCount,
        unavailableCategories: scoringResult.unavailableCategories,
        strengths: scoringResult.strengths.map((item) => ({
          checkKey: item.checkKey,
          category: item.category,
          title: item.title,
        })),
        opportunities: scoringResult.opportunities.map((item) => ({
          checkKey: item.checkKey,
          category: item.category,
          title: item.title,
          status: item.status,
        })),
      },
    };
    await deps.persistence.saveProgress(input.runId, progress);
  } catch (error) {
    scoringFailed = true;
    const message = error instanceof Error ? error.message : "Scoring failed";
    errorCode = errorCode ?? "scoring_failed";
    errorMessageInternal = [errorMessageInternal, message].filter(Boolean).join(" | ");
    progress = {
      ...progress,
      scoring: {
        scoringVersion: "unknown",
        weightSetVersion: "unknown",
        unavailableCategories: [],
        strengths: [],
        opportunities: [],
        scoringError: message,
      },
    };
    await deps.persistence.saveProgress(input.runId, progress);
  }

  progress = withPhase(progress, "recommendations", now());
  await deps.persistence.saveProgress(input.runId, progress);

  try {
    const recommendationResult = generateRecommendations(
      collectedFindings,
      input.scope,
    );
    await deps.persistence.saveRecommendations(
      input.runId,
      recommendationResult.recommendations,
    );
    progress = {
      ...progress,
      scoring: {
        ...(progress.scoring ?? {
          scoringVersion: scoringResult?.scoringVersion ?? "unknown",
          weightSetVersion: scoringResult?.weightSetVersion ?? "unknown",
          unavailableCategories: scoringResult?.unavailableCategories ?? [],
          strengths: [],
          opportunities: [],
        }),
        recommendationCatalogVersion: recommendationResult.catalogVersion,
      },
    };
    await deps.persistence.saveProgress(input.runId, progress);
  } catch (error) {
    recommendationsFailed = true;
    const message =
      error instanceof Error ? error.message : "Recommendation generation failed";
    errorCode = errorCode ?? "recommendations_failed";
    errorMessageInternal = [errorMessageInternal, message].filter(Boolean).join(" | ");
    progress = {
      ...progress,
      scoring: {
        ...(progress.scoring ?? {
          scoringVersion: "unknown",
          weightSetVersion: "unknown",
          unavailableCategories: [],
          strengths: [],
          opportunities: [],
        }),
        recommendationError: message,
      },
    };
    await deps.persistence.saveProgress(input.runId, progress);
  }

  progress = withPhase(progress, "complete", now());

  let status = resolveRunStatus(progress, fatalError);
  if (scoringFailed || recommendationsFailed) {
    status =
      status === "failed"
        ? "failed"
        : countFailedCollectors(progress).length > 0
          ? "partially_succeeded"
          : "partially_succeeded";
  }

  const failedCollectors = countFailedCollectors(progress);

  await deps.persistence.completeRun(input.runId, {
    status,
    overallScore,
    summary,
    progress,
    errorCode,
    errorMessageInternal,
  });

  await deps.persistence.markRequestStatus(
    input.requestId,
    status === "failed" ? "failed" : "completed",
  );

  return {
    runId: input.runId,
    status,
    overallScore,
    summary,
    findingCount: collectedFindings.length,
    failedCollectors,
  };
}

export function listCollectorsForScope(
  collectors: AuditCollector[],
  scope: RunAuditInput["scope"],
): AuditCollector[] {
  return collectors.filter((collector) => collector.supports(scope));
}

export { AUDIT_ENGINE_VERSION };
