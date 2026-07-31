import {
  annotateFindingsForScoring,
  buildOpportunities,
  buildStrengths,
  type OpportunityItem,
  type ScoredFinding,
  type StrengthItem,
} from "@/lib/audit/scoring/categories";
import {
  clampScore,
  pointsForFindingStatus,
  SCORABLE_STATUSES,
} from "@/lib/audit/scoring/impacts";
import { SCORING_VERSION } from "@/lib/audit/scoring/weights";
import {
  getWeightSetForScope,
  type CategoryWeightMap,
  type ScoringCategory,
} from "@/lib/audit/scoring/weights";
import type { AuditFindingInput, AuditScope } from "@/lib/audit/types";

export type CategoryScoreResult = {
  category: ScoringCategory;
  score: number;
  weight: number;
  findingCount: number;
  scorableFindingCount: number;
};

export type ScoringResult = {
  scoringVersion: string;
  weightSetVersion: string;
  overallScore: number | null;
  categoryScores: CategoryScoreResult[];
  unavailableCategories: ScoringCategory[];
  /** Categories with weight > 0 in the active weight set. */
  eligibleCategoryCount: number;
  /** Categories that contributed a score to the overall result. */
  scoredCategoryCount: number;
  strengths: StrengthItem[];
  opportunities: OpportunityItem[];
};

export function scoreAuditFindings(
  findings: AuditFindingInput[],
  scope: AuditScope,
): ScoringResult {
  const { weightSetVersion, weights } = getWeightSetForScope(scope);
  const scoredFindings = annotateFindingsForScoring(findings, scope);
  const categoryWeight = (category: ScoringCategory) => weights[category] ?? 0;

  const categoryScores: CategoryScoreResult[] = [];
  const unavailableCategories: ScoringCategory[] = [];

  const activeCategories = (
    Object.entries(weights) as Array<[ScoringCategory, number]>
  )
    .filter(([, weight]) => weight > 0)
    .map(([category]) => category)
    .sort((a, b) => a.localeCompare(b));

  for (const category of activeCategories) {
    const categoryFindings = scoredFindings.filter(
      (finding) => finding.scoringCategory === category,
    );
    const scorable = categoryFindings.filter((finding) =>
      SCORABLE_STATUSES.has(finding.status),
    );

    if (scorable.length === 0) {
      unavailableCategories.push(category);
      continue;
    }

    const points = scorable.map((finding) => pointsForFindingStatus(finding.status)!);
    const average = points.reduce((sum, value) => sum + value, 0) / points.length;

    categoryScores.push({
      category,
      score: clampScore(average),
      weight: weights[category],
      findingCount: categoryFindings.length,
      scorableFindingCount: scorable.length,
    });
  }

  const weightTotal = categoryScores.reduce((sum, row) => sum + row.weight, 0);
  const overallScore =
    weightTotal === 0
      ? null
      : clampScore(
          categoryScores.reduce((sum, row) => sum + row.score * row.weight, 0) /
            weightTotal,
        );

  return {
    scoringVersion: SCORING_VERSION,
    weightSetVersion,
    overallScore,
    categoryScores,
    unavailableCategories: unavailableCategories.sort((a, b) => a.localeCompare(b)),
    eligibleCategoryCount: activeCategories.length,
    scoredCategoryCount: categoryScores.length,
    strengths: buildStrengths(scoredFindings, categoryWeight),
    opportunities: buildOpportunities(scoredFindings, categoryWeight),
  };
}

export function summarizeScore(result: ScoringResult): string {
  if (result.overallScore == null) {
    return "Overall score unavailable — no scorable categories.";
  }

  const topOpportunity = result.opportunities[0];
  if (!topOpportunity) {
    return `Overall score ${result.overallScore}/100. No major opportunities detected.`;
  }

  return `Overall score ${result.overallScore}/100. Top opportunity: ${topOpportunity.title}.`;
}

export type { CategoryWeightMap, ScoringCategory };
