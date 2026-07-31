import type { AuditRunProgress, CollectorProgressEntry } from "@/lib/audit/types";

export function createInitialProgress(
  collectorKeys: string[],
  now = new Date(),
): AuditRunProgress {
  const collectors: Record<string, CollectorProgressEntry> = {};
  for (const key of collectorKeys) {
    collectors[key] = { status: "pending" };
  }

  return {
    phase: "queued",
    collectors,
    updatedAt: now.toISOString(),
  };
}

export function withPhase(
  progress: AuditRunProgress,
  phase: AuditRunProgress["phase"],
  now = new Date(),
): AuditRunProgress {
  return {
    ...progress,
    phase,
    updatedAt: now.toISOString(),
  };
}

export function withCollectorRunning(
  progress: AuditRunProgress,
  collectorKey: string,
  now = new Date(),
): AuditRunProgress {
  return {
    ...progress,
    phase: "collecting",
    currentCollectorKey: collectorKey,
    collectors: {
      ...progress.collectors,
      [collectorKey]: {
        status: "running",
        startedAt: now.toISOString(),
      },
    },
    updatedAt: now.toISOString(),
  };
}

export function withCollectorFinished(
  progress: AuditRunProgress,
  collectorKey: string,
  entry: Pick<CollectorProgressEntry, "status" | "errorCode" | "errorMessage">,
  now = new Date(),
): AuditRunProgress {
  const existing = progress.collectors[collectorKey];
  return {
    ...progress,
    currentCollectorKey: undefined,
    collectors: {
      ...progress.collectors,
      [collectorKey]: {
        ...existing,
        ...entry,
        completedAt: now.toISOString(),
      },
    },
    updatedAt: now.toISOString(),
  };
}

export function countFailedCollectors(progress: AuditRunProgress): string[] {
  return Object.entries(progress.collectors)
    .filter(([, entry]) => entry.status === "failed")
    .map(([key]) => key);
}

export function resolveRunStatus(
  progress: AuditRunProgress,
  fatalError: boolean,
): "succeeded" | "partially_succeeded" | "failed" {
  if (fatalError) return "failed";

  const failed = countFailedCollectors(progress);
  if (failed.length === 0) return "succeeded";
  return "partially_succeeded";
}
