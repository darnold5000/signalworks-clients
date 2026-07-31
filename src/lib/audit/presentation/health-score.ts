export type ScoreConfidence = "high" | "medium" | "limited";

/** Based on how many categories were scored (not eligible total). */
export function getScoreConfidence(scoredCategoryCount: number): ScoreConfidence {
  if (scoredCategoryCount >= 9) return "high";
  if (scoredCategoryCount >= 7) return "medium";
  return "limited";
}

export function formatConfidenceLabel(confidence: ScoreConfidence): string {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  return "Limited";
}

export function formatCoverageShort(scoredCount: number, eligibleCount: number): string {
  return `${scoredCount} of ${eligibleCount} categories`;
}

export const HEALTH_CHECK_PRODUCT_NAME = "Website Health Check";
