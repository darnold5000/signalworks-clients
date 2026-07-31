import type { AuditFindingInput } from "@/lib/audit/types";
import type { AuditHistoryComparison } from "@/lib/audit/admin/types";

type FindingLike = Pick<AuditFindingInput, "checkKey" | "status">;

export function compareAuditHistory(input: {
  currentFindings: FindingLike[];
  previousFindings: FindingLike[];
  currentScores: Array<{ category: string; score: number }>;
  previousScores: Array<{ category: string; score: number }>;
  currentOverall: number | null;
  previousOverall: number | null;
  previousRunId: string | null;
  previousCompletedAt: string | null;
}): AuditHistoryComparison {
  const currentIssueKeys = new Set(
    input.currentFindings
      .filter((finding) => finding.status === "warning" || finding.status === "fail")
      .map((finding) => finding.checkKey),
  );
  const previousIssueKeys = new Set(
    input.previousFindings
      .filter((finding) => finding.status === "warning" || finding.status === "fail")
      .map((finding) => finding.checkKey),
  );

  const newFindings = [...currentIssueKeys]
    .filter((key) => !previousIssueKeys.has(key))
    .sort();
  const resolvedFindings = [...previousIssueKeys]
    .filter((key) => !currentIssueKeys.has(key))
    .sort();
  const recurringFindings = [...currentIssueKeys]
    .filter((key) => previousIssueKeys.has(key))
    .sort();

  const previousScoreMap = new Map(
    input.previousScores.map((row) => [row.category, row.score]),
  );

  const categoryChanges = input.currentScores
    .map((row) => {
      const previousScore = previousScoreMap.get(row.category) ?? null;
      return {
        category: row.category,
        previousScore,
        currentScore: row.score,
        change:
          previousScore == null ? null : Math.round((row.score - previousScore) * 100) / 100,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    previousRunId: input.previousRunId,
    previousCompletedAt: input.previousCompletedAt,
    overallScoreChange:
      input.currentOverall != null && input.previousOverall != null
        ? Math.round((input.currentOverall - input.previousOverall) * 100) / 100
        : null,
    categoryChanges,
    newFindings,
    resolvedFindings,
    recurringFindings,
  };
}

export function formatScoreCoverageLabel(
  scoredCount: number,
  eligibleCount: number,
): string {
  return `Score based on ${scoredCount} of ${eligibleCount} available categories`;
}
