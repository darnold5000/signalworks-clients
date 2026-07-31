import { AUDIT_SCOPE_VERSIONS } from "@/lib/audit/constants";
import type { AuditScope } from "@/lib/audit/types";

/** Identifies which weight configuration was applied. */
export const SCORING_VERSION = "1.0.0";

export const WEIGHT_SET_VERSIONS = {
  public: "public-weights-1",
  client_health: "client-health-weights-1-draft",
} as const;

export type WeightSetId = keyof typeof WEIGHT_SET_VERSIONS;

export type ScoringCategory =
  | "performance"
  | "technical"
  | "seo"
  | "local_seo"
  | "conversion"
  | "aeo"
  | "accessibility"
  | "security"
  | "operations"
  | "email_auth";

export type CategoryWeightMap = Record<ScoringCategory, number>;

/** Public audit category weights (must sum to 100). */
export const PUBLIC_CATEGORY_WEIGHTS: CategoryWeightMap = {
  performance: 20,
  technical: 20,
  seo: 20,
  local_seo: 0,
  conversion: 15,
  aeo: 10,
  accessibility: 10,
  security: 5,
  operations: 0,
  email_auth: 0,
};

/**
 * Draft client-health weights — not finalized until collector set is reviewed.
 * `local_seo` and `operations` are included; `email_auth` reserved for a future collector.
 */
export const CLIENT_HEALTH_CATEGORY_WEIGHTS: CategoryWeightMap = {
  performance: 15,
  technical: 15,
  seo: 12,
  local_seo: 8,
  conversion: 12,
  aeo: 8,
  accessibility: 8,
  security: 5,
  operations: 12,
  email_auth: 5,
};

export function getWeightSetForScope(scope: AuditScope): {
  weightSetVersion: string;
  weights: CategoryWeightMap;
} {
  if (
    scope.auditType === "client_health" ||
    scope.scopeVersion === AUDIT_SCOPE_VERSIONS.client_health
  ) {
    return {
      weightSetVersion: WEIGHT_SET_VERSIONS.client_health,
      weights: CLIENT_HEALTH_CATEGORY_WEIGHTS,
    };
  }

  return {
    weightSetVersion: WEIGHT_SET_VERSIONS.public,
    weights: PUBLIC_CATEGORY_WEIGHTS,
  };
}
