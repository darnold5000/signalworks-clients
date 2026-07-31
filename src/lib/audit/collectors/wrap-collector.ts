import type { AuditCollector, AuditCollectorResult } from "@/lib/audit/types";

export type CollectorTimeoutOptions = {
  timeoutMs: number;
};

function timeoutResult(
  collectorKey: string,
  timeoutMs: number,
): AuditCollectorResult {
  return {
    collectorKey,
    findings: [
      {
        category: "technical",
        checkKey: `${collectorKey}.collector_timeout`,
        severity: "medium",
        status: "unavailable",
        title: "Collector timed out",
        summary: `The ${collectorKey} collector exceeded the ${timeoutMs}ms time limit.`,
        sourceType: "automated",
        sourceLabel: "Audit collector runtime",
        evidenceJson: { timeoutMs },
      },
    ],
    errorCode: "collector_timeout",
    errorMessage: `Collector exceeded ${timeoutMs}ms`,
  };
}

function errorResult(collectorKey: string, error: unknown): AuditCollectorResult {
  const message =
    error instanceof Error ? error.message : "Collector execution failed";
  return {
    collectorKey,
    findings: [],
    errorCode: "collector_error",
    errorMessage: message,
  };
}

/** Ensures collectors never throw and respect a per-collector timeout. */
export function wrapCollector(
  collector: AuditCollector,
  options: CollectorTimeoutOptions,
): AuditCollector {
  return {
    key: collector.key,
    supports: collector.supports,
    async collect(context) {
      try {
        const result = await Promise.race([
          collector.collect(context),
          new Promise<AuditCollectorResult>((resolve) => {
            setTimeout(
              () => resolve(timeoutResult(collector.key, options.timeoutMs)),
              options.timeoutMs,
            );
          }),
        ]);
        return result;
      } catch (error) {
        return errorResult(collector.key, error);
      }
    },
  };
}
