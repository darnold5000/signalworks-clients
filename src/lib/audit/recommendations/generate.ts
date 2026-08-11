import { SEVERITY_ORDER } from "@/lib/audit/scoring/categories";
import {
  RECOMMENDATION_CATALOG_VERSION,
  RECOMMENDATION_RULES,
  type RecommendationPriority,
  type RecommendationRule,
} from "@/lib/audit/recommendations/catalog";
import type { AuditFindingInput, AuditScope } from "@/lib/audit/types";
import { dedupeCustomerRecommendations } from "@/lib/audit/presentation/customer";

export type GeneratedRecommendation = {
  recommendationKey: string;
  category: RecommendationRule["category"];
  title: string;
  description: string;
  priority: RecommendationPriority;
  impact: string;
  effort: string;
  supportingFindingKeys: string[];
  signalworksServiceKey: string | null;
  isPublic: boolean;
  isClientVisible: boolean;
};

export type RecommendationResult = {
  catalogVersion: string;
  recommendations: GeneratedRecommendation[];
};

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function ruleMatchesFinding(
  rule: RecommendationRule,
  finding: AuditFindingInput,
): boolean {
  if (!rule.triggerStatuses.includes(finding.status)) return false;
  return rule.matchingFindingKeys.includes(finding.checkKey);
}

export function generateRecommendations(
  findings: AuditFindingInput[],
  scope: AuditScope,
): RecommendationResult {
  const byKey = new Map<string, GeneratedRecommendation>();

  for (const rule of RECOMMENDATION_RULES) {
    const supportingFindingKeys = findings
      .filter((finding) => ruleMatchesFinding(rule, finding))
      .map((finding) => finding.checkKey)
      .sort((a, b) => a.localeCompare(b));

    if (supportingFindingKeys.length === 0) continue;

    const existing = byKey.get(rule.recommendationKey);
    if (existing) {
      existing.supportingFindingKeys = [
        ...new Set([...existing.supportingFindingKeys, ...supportingFindingKeys]),
      ].sort((a, b) => a.localeCompare(b));
      continue;
    }

    byKey.set(rule.recommendationKey, {
      recommendationKey: rule.recommendationKey,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      priority: rule.priority,
      impact: rule.impact,
      effort: rule.effort,
      supportingFindingKeys,
      signalworksServiceKey: rule.signalworksServiceKey ?? null,
      isPublic: rule.isPublic,
      isClientVisible: rule.isClientVisible,
    });
  }

  const recommendations = [...byKey.values()].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const impactDiff = b.supportingFindingKeys.length - a.supportingFindingKeys.length;
    if (impactDiff !== 0) return impactDiff;

    return a.recommendationKey.localeCompare(b.recommendationKey);
  });

  return {
    catalogVersion: RECOMMENDATION_CATALOG_VERSION,
    recommendations: applyScopeVisibility(recommendations, scope),
  };
}

function applyScopeVisibility(
  recommendations: GeneratedRecommendation[],
  scope: AuditScope,
): GeneratedRecommendation[] {
  if (!scope.isPublicReport) return recommendations;
  return dedupeCustomerRecommendations(
    recommendations.filter((recommendation) => recommendation.isPublic),
  );
}

export function filterRecommendationsForAudience(
  recommendations: GeneratedRecommendation[],
  audience: "public" | "client" | "staff",
): GeneratedRecommendation[] {
  if (audience === "staff") return recommendations;
  if (audience === "public") {
    return dedupeCustomerRecommendations(
      recommendations.filter((recommendation) => recommendation.isPublic),
    );
  }
  return recommendations.filter((recommendation) => recommendation.isClientVisible);
}
