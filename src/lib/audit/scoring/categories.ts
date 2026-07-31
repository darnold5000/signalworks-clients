import type { AuditFindingInput, AuditScope, FindingSeverity } from "@/lib/audit/types";
import type { ScoringCategory } from "@/lib/audit/scoring/weights";

export type ScoredFinding = AuditFindingInput & {
  scoringCategory: ScoringCategory;
};

export const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * Maps collector finding categories to scoring buckets.
 * `content` findings roll into SEO for scoring purposes.
 */
export function resolveScoringCategory(
  finding: AuditFindingInput,
  scope: AuditScope,
): ScoringCategory | null {
  const category = finding.category;

  if (category === "content") return "seo";

  if (category === "local_seo") {
    return scope.scopeVersion.includes("client-health") ? "local_seo" : "seo";
  }

  if (
    category === "performance" ||
    category === "technical" ||
    category === "seo" ||
    category === "conversion" ||
    category === "aeo" ||
    category === "accessibility" ||
    category === "security" ||
    category === "operations" ||
    category === "email_auth"
  ) {
    return category;
  }

  return null;
}

export function annotateFindingsForScoring(
  findings: AuditFindingInput[],
  scope: AuditScope,
): ScoredFinding[] {
  const scored: ScoredFinding[] = [];

  for (const finding of findings) {
    const scoringCategory = resolveScoringCategory(finding, scope);
    if (!scoringCategory) continue;
    scored.push({ ...finding, scoringCategory });
  }

  return scored;
}

export type StrengthItem = {
  checkKey: string;
  category: ScoringCategory;
  title: string;
  summary: string;
  severity: FindingSeverity;
};

export type OpportunityItem = {
  checkKey: string;
  category: ScoringCategory;
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: AuditFindingInput["status"];
};

export function buildStrengths(
  findings: ScoredFinding[],
  categoryWeight: (category: ScoringCategory) => number,
  limit = 5,
): StrengthItem[] {
  return findings
    .filter((finding) => finding.status === "pass")
    .sort((a, b) => {
      const weightDiff = categoryWeight(b.scoringCategory) - categoryWeight(a.scoringCategory);
      if (weightDiff !== 0) return weightDiff;
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.checkKey.localeCompare(b.checkKey);
    })
    .slice(0, limit)
    .map((finding) => ({
      checkKey: finding.checkKey,
      category: finding.scoringCategory,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
    }));
}

export function buildOpportunities(
  findings: ScoredFinding[],
  categoryWeight: (category: ScoringCategory) => number,
  limit = 5,
): OpportunityItem[] {
  return findings
    .filter((finding) => finding.status === "warning" || finding.status === "fail")
    .sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;
      const weightDiff = categoryWeight(b.scoringCategory) - categoryWeight(a.scoringCategory);
      if (weightDiff !== 0) return weightDiff;
      return a.checkKey.localeCompare(b.checkKey);
    })
    .slice(0, limit)
    .map((finding) => ({
      checkKey: finding.checkKey,
      category: finding.scoringCategory,
      title: finding.title,
      summary: finding.summary,
      severity: finding.severity,
      status: finding.status,
    }));
}
