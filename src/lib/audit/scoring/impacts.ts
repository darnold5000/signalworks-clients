import type { FindingStatus } from "@/lib/audit/types";

/** Deterministic point value per finding status (0–100 scale). */
export const FINDING_STATUS_POINTS: Record<
  Extract<FindingStatus, "pass" | "warning" | "fail">,
  number
> = {
  pass: 100,
  warning: 65,
  fail: 0,
};

export const SCORABLE_STATUSES: ReadonlySet<FindingStatus> = new Set([
  "pass",
  "warning",
  "fail",
]);

export const EXCLUDED_STATUSES: ReadonlySet<FindingStatus> = new Set([
  "unavailable",
  "manual_review",
]);

export function pointsForFindingStatus(status: FindingStatus): number | null {
  if (EXCLUDED_STATUSES.has(status)) return null;
  if (status === "pass" || status === "warning" || status === "fail") {
    return FINDING_STATUS_POINTS[status];
  }
  return null;
}

export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}
