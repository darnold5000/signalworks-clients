import type { AuditCollector, AuditContext, AuditFindingInput } from "@/lib/audit/types";
import type { AuditRunPersistence, AuditRunProgress } from "@/lib/audit/types";
import {
  withCollectorFinished,
  withCollectorRunning,
} from "@/lib/audit/runner/progress";

const HTTP_COLLECTOR_KEY = "http_hosting";

type CollectorRunParams = {
  collector: AuditCollector;
  context: AuditContext;
  runId: string;
  tenantId: string | null;
  persistence: AuditRunPersistence;
  now: () => Date;
  onFindings: (findings: AuditFindingInput[]) => void;
  getProgress: () => AuditRunProgress;
  setProgress: (progress: AuditRunProgress) => void;
};

async function runSingleCollector(params: CollectorRunParams): Promise<void> {
  const {
    collector,
    context,
    runId,
    tenantId,
    persistence,
    now,
    onFindings,
    getProgress,
    setProgress,
  } = params;

  let progress = withCollectorRunning(getProgress(), collector.key, now());
  setProgress(progress);
  await persistence.saveProgress(runId, progress);

  try {
    const result = await collector.collect(context);
    onFindings(result.findings);
    await persistence.saveCollectorFindings(runId, tenantId, result);

    progress = withCollectorFinished(
      getProgress(),
      collector.key,
      {
        status: result.errorCode ? "failed" : "succeeded",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
      now(),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Collector execution failed";
    progress = withCollectorFinished(
      getProgress(),
      collector.key,
      {
        status: "failed",
        errorCode: "collector_threw",
        errorMessage: message,
      },
      now(),
    );
  }

  setProgress(progress);
  await persistence.saveProgress(runId, progress);
}

export async function runCollectorsWithConcurrency(
  collectors: AuditCollector[],
  params: Omit<CollectorRunParams, "collector">,
): Promise<void> {
  const httpCollector = collectors.find((collector) => collector.key === HTTP_COLLECTOR_KEY);
  const parallelCollectors = collectors.filter(
    (collector) => collector.key !== HTTP_COLLECTOR_KEY,
  );

  if (httpCollector) {
    await runSingleCollector({ ...params, collector: httpCollector });
  }

  if (parallelCollectors.length > 0) {
    await Promise.all(
      parallelCollectors.map((collector) =>
        runSingleCollector({ ...params, collector }),
      ),
    );
  }
}
