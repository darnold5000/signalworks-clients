import { PUBLIC_CATEGORY_WEIGHTS } from "@/lib/audit/scoring/weights";
import { filterRecommendationsForAudience } from "@/lib/audit/recommendations/generate";
import type { GeneratedRecommendation } from "@/lib/audit/recommendations/generate";

export const PUBLIC_SCORING_CATEGORIES = (
  Object.keys(PUBLIC_CATEGORY_WEIGHTS) as Array<keyof typeof PUBLIC_CATEGORY_WEIGHTS>
).filter((category) => PUBLIC_CATEGORY_WEIGHTS[category] > 0);

type FindingLike = {
  category: string;
  checkKey: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  sourceLabel: string;
  isPublic: boolean;
  sourceType: string;
};

export function filterFindingsForPublicAudience<T extends FindingLike>(
  findings: T[],
): T[] {
  return findings.filter((finding) => {
    if (finding.isPublic) return true;
    if (finding.sourceType === "verified") return false;
    if (!PUBLIC_SCORING_CATEGORIES.includes(finding.category as (typeof PUBLIC_SCORING_CATEGORIES)[number])) {
      return false;
    }
    return finding.status === "pass" || finding.status === "warning" || finding.status === "fail";
  });
}

export function filterRecommendationsForPublic(
  recommendations: GeneratedRecommendation[],
) {
  return filterRecommendationsForAudience(recommendations, "public");
}
