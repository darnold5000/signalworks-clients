import {
  recommendationCategoryForKey,
  recommendationCategoryLabel,
} from "@/lib/audit/presentation/recommendation-catalog";
import type { PublicAuditRecommendation } from "@/lib/audit/public/types";

export type ReportRecommendation = PublicAuditRecommendation;

function isQuickWin(rec: ReportRecommendation): boolean {
  const effort = rec.effort?.toLowerCase() ?? "";
  return (rec.priority === "high" || rec.priority === "critical") && effort.includes("low");
}

export function groupRecommendationsForReport(recommendations: ReportRecommendation[]) {
  const quickWins = recommendations.filter(isQuickWin);
  const quickWinKeys = new Set(quickWins.map((rec) => rec.recommendationKey));
  const remaining = recommendations.filter(
    (rec) => !quickWinKeys.has(rec.recommendationKey),
  );

  const byCategory = new Map<string, ReportRecommendation[]>();
  for (const rec of remaining) {
    const category = rec.category || recommendationCategoryForKey(rec.recommendationKey);
    const list = byCategory.get(category) ?? [];
    list.push({ ...rec, category });
    byCategory.set(category, list);
  }

  const categoryGroups = [...byCategory.entries()]
    .sort(([a], [b]) =>
      recommendationCategoryLabel(a).localeCompare(recommendationCategoryLabel(b)),
    )
    .map(([category, items]) => ({
      category,
      label: recommendationCategoryLabel(category),
      items,
    }));

  return { quickWins, categoryGroups };
}

export { recommendationCategoryLabel };
