import type { OperationsHealthStatus } from "@/lib/client-health/constants";

const SEVERITY: Record<OperationsHealthStatus, number> = {
  critical: 4,
  warning: 3,
  unknown: 2,
  healthy: 1,
  not_configured: 0,
};

/** Worst meaningful provider status; `not_configured` does not affect rollup. */
export function rollupOperationsHealthStatus(
  statuses: OperationsHealthStatus[],
): OperationsHealthStatus {
  const meaningful = statuses.filter((s) => s !== "not_configured");
  if (meaningful.length === 0) return "not_configured";

  return meaningful.reduce((worst, current) =>
    SEVERITY[current] > SEVERITY[worst] ? current : worst,
  );
}
