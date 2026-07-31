import { RECOMMENDATION_RULES } from "@/lib/audit/recommendations/catalog";

const categoryByKey = new Map(
  RECOMMENDATION_RULES.map((rule) => [rule.recommendationKey, rule.category]),
);

export function recommendationCategoryForKey(recommendationKey: string): string {
  return categoryByKey.get(recommendationKey) ?? "technical";
}

export const RECOMMENDATION_CATEGORY_LABELS: Record<string, string> = {
  seo: "SEO",
  technical: "Technical",
  performance: "Performance",
  conversion: "Conversion",
  content: "Homepage content",
  aeo: "AI search",
  accessibility: "Accessibility",
  security: "Security",
  local_seo: "Local SEO",
  operations: "Operations",
  email_auth: "Email authentication",
};

export function recommendationCategoryLabel(category: string): string {
  return RECOMMENDATION_CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}
