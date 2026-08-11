export type CustomerAuditPresentation = {
  customerTitle: string;
  customerDescription: string;
  customerCategory: string;
  technicalTitle: string;
  technicalValue: string | null;
};

type CustomerRecommendationLike = {
  recommendationKey: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  supportingFindingKeys?: string[];
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function recommendationIdentity(recommendation: CustomerRecommendationLike) {
  if (recommendation.recommendationKey.startsWith("performance.improve_mobile_")) {
    return "performance.improve_mobile_loading";
  }
  if (recommendation.recommendationKey.includes("localbusiness_schema")) {
    return "seo.localbusiness_schema";
  }
  const title = presentCustomerRecommendation(recommendation).customerTitle;
  if (title === "Help Google understand your business") {
    return "seo.localbusiness_schema";
  }
  // Generic fallback copy is intentionally not an identity: several unrelated
  // categories can legitimately use that copy.
  if (title.startsWith("Your website ")) return recommendation.recommendationKey;
  return title.trim().toLowerCase();
}

/** Removes duplicate customer-facing recommendations while retaining the strongest evidence. */
export function dedupeCustomerRecommendations<T extends CustomerRecommendationLike>(
  recommendations: T[],
): T[] {
  const selected = new Map<string, T>();

  for (const recommendation of recommendations) {
    const identity = recommendationIdentity(recommendation);
    const current = selected.get(identity);
    if (!current) {
      selected.set(identity, recommendation);
      continue;
    }

    const currentPriority = PRIORITY_ORDER[current.priority] ?? Number.MAX_SAFE_INTEGER;
    const nextPriority = PRIORITY_ORDER[recommendation.priority] ?? Number.MAX_SAFE_INTEGER;
    const currentEvidence = current.supportingFindingKeys?.length ?? 0;
    const nextEvidence = recommendation.supportingFindingKeys?.length ?? 0;
    const currentSpecificity = current.recommendationKey.startsWith("seo.") ? 0 : 1;
    const nextSpecificity = recommendation.recommendationKey.startsWith("seo.") ? 0 : 1;
    if (
      nextPriority < currentPriority ||
      (nextPriority === currentPriority && nextEvidence > currentEvidence) ||
      (nextPriority === currentPriority && nextEvidence === currentEvidence && nextSpecificity < currentSpecificity) ||
      (nextPriority === currentPriority && nextEvidence === currentEvidence && nextSpecificity === currentSpecificity && recommendation.recommendationKey < current.recommendationKey)
    ) {
      selected.set(identity, recommendation);
    }
  }

  return recommendations.filter((recommendation) => selected.get(recommendationIdentity(recommendation)) === recommendation);
}

export function formatMilliseconds(value: number | string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `${(numeric / 1000).toFixed(1)} seconds` : String(value);
}

function millisecondsIn(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*ms\b/i);
  return match ? formatMilliseconds(match[1]) : null;
}

function categoryLabel(category: string) {
  return ({
    performance: "Speed & Performance",
    seo: "SEO Setup",
    aeo: "AI & Answer Readiness",
    conversion: "Conversion Readiness",
    technical: "Website Technology",
    local_seo: "Google Maps & Local Search",
  } as Record<string, string>)[category] ?? category;
}

export function presentCustomerFinding(input: {
  checkKey: string;
  category: string;
  title: string;
  summary: string;
}): CustomerAuditPresentation {
  const text = `${input.checkKey} ${input.title} ${input.summary}`;
  const lower = text.toLowerCase();
  const measured = millisecondsIn(text);
  if (lower.includes("lcp") || lower.includes("largest contentful")) return { customerTitle: "Improve mobile loading speed", customerDescription: measured ? `Your main content takes about ${measured} to appear on mobile.` : "Your main content takes too long to appear on mobile.", customerCategory: "Speed & Performance", technicalTitle: "Largest Contentful Paint (LCP)", technicalValue: measured };
  if (lower.includes("cls") || lower.includes("cumulative layout")) return { customerTitle: "Excellent page stability", customerDescription: "Your website stays visually stable while loading, creating a smoother experience for visitors.", customerCategory: "Speed & Performance", technicalTitle: "Cumulative Layout Shift (CLS)", technicalValue: null };
  if (lower.includes("localbusiness") || lower.includes("structured data") || lower.includes("json-ld")) return { customerTitle: "Help Google understand your business", customerDescription: "Provide search engines with clear information about your business name, location, services, contact details, and hours.", customerCategory: "SEO Setup", technicalTitle: "Structured business information (JSON-LD)", technicalValue: "Not detected" };
  if (lower.includes("h1") || lower.includes("heading")) return { customerTitle: "Clarify your homepage's main message", customerDescription: "Your homepage should have one clear primary heading that tells visitors what your business does and where you serve customers.", customerCategory: "SEO Setup", technicalTitle: "Primary page heading (H1)", technicalValue: null };
  if (lower.includes("canonical")) return { customerTitle: "Search engines can identify your primary page", customerDescription: "Your website correctly identifies the preferred version of the page for search engines.", customerCategory: "SEO Setup", technicalTitle: "Canonical URL", technicalValue: "Present" };
  if (lower.includes("privacy")) return { customerTitle: "Privacy information is easy to find", customerDescription: "Visitors can access your website's privacy information when they need it.", customerCategory: categoryLabel(input.category), technicalTitle: "Privacy policy link", technicalValue: "Found" };
  if (lower.includes("service-related") || lower.includes("service content")) return { customerTitle: "Your services are clearly represented", customerDescription: "Your website includes content that helps visitors understand what your business offers.", customerCategory: categoryLabel(input.category), technicalTitle: "Service-related content", technicalValue: "Detected" };
  if (lower.includes("homepage content") || lower.includes("content length")) return { customerTitle: "Your homepage provides useful content", customerDescription: "Your homepage contains enough information to help visitors and search engines understand your business.", customerCategory: categoryLabel(input.category), technicalTitle: "Homepage content length", technicalValue: "Adequate" };
  return { customerTitle: categoryLabel(input.category) === "Security" ? "Your website includes important safeguards" : "Your website has a useful foundation here", customerDescription: `This supports a clearer, more useful experience for visitors and helps your website perform better in ${categoryLabel(input.category).toLowerCase()}.`, customerCategory: categoryLabel(input.category), technicalTitle: input.title, technicalValue: null };
}

export function presentCustomerRecommendation(input: { category: string; title: string; description: string; recommendationKey?: string }): CustomerAuditPresentation {
  return presentCustomerFinding({ checkKey: input.recommendationKey ?? "", category: input.category, title: input.title, summary: input.description });
}
