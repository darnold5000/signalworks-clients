import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import { AUDIT_SCOPE_VERSIONS } from "@/lib/audit/constants";
import { createDefaultCollectors } from "@/lib/audit/collectors";
import { createCollectorServices } from "@/lib/audit/collectors/services";
import { createPageSpeedClient } from "@/lib/audit/collectors/pagespeed/client";
import {
  createAuditExecution,
  createSupabaseAuditPersistence,
  saveSearchVisibilitySnapshot,
} from "@/lib/audit/persistence/audit-repository";
import { runAudit } from "@/lib/audit/runner/run-audit";
import { createSafeFetch } from "@/lib/audit/url/safe-fetch";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import type {
  AuditCollector,
  AuditCollectorServices,
  AuditRunOutcome,
  AuditScope,
  AuditType,
} from "@/lib/audit/types";
import { runSearchVisibility } from "@/lib/audit/search-visibility/run";

export type ExecuteAuditInput = {
  rawUrl: string;
  auditType: AuditType;
  tenantId?: string | null;
  businessName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  city?: string | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  requestedByUserId?: string | null;
  internalNotes?: string | null;
};

export type ExecuteAuditOptions = {
  collectors?: AuditCollector[];
  collectorServices?: AuditCollectorServices;
};

export type ExecuteAuditResult = AuditRunOutcome & {
  requestId: string;
  publicAccessToken: string;
};

function buildScope(auditType: AuditType): AuditScope {
  const isPublic = auditType === "public";
  return {
    auditType,
    scopeVersion: isPublic
      ? AUDIT_SCOPE_VERSIONS.public
      : AUDIT_SCOPE_VERSIONS.client_health,
    includeOperationsInventory: !isPublic,
    includeEmailAuth: !isPublic,
    isPublicReport: isPublic,
  };
}

async function loadTechnicalProfile(
  tenantId: string,
): Promise<TenantTechnicalProfile | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.tenantTechnicalProfiles)
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as TenantTechnicalProfile | null) ?? null;
}

/**
 * Creates the audit request + run, then executes collectors synchronously in-process.
 * Progress is persisted to audit_runs.progress_json after each collector.
 */
export async function executeAuditSynchronously(
  input: ExecuteAuditInput,
  options: ExecuteAuditOptions = {},
): Promise<ExecuteAuditResult> {
  const url = normalizeAuditUrl(input.rawUrl);
  const scope = buildScope(input.auditType);
  const tenantId = input.tenantId ?? null;

  const supabase = createServiceClient();
  const created = await createAuditExecution(supabase, {
    auditType: input.auditType,
    scopeVersion: scope.scopeVersion,
    tenantId,
    url,
    businessName: input.businessName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    city: input.city,
    source: input.source,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    requestedByUserId: input.requestedByUserId,
    internalNotes: input.internalNotes,
  });

  const collectorServices =
    options.collectorServices ??
    createCollectorServices({
      url,
      fetchPage: createSafeFetch(),
      pagespeedClient: createPageSpeedClient(),
      loadTechnicalProfile,
    });

  const outcome = await runAudit(
    {
      runId: created.runId,
      requestId: created.requestId,
      tenantId,
      scope,
      url,
    },
    {
      persistence: createSupabaseAuditPersistence(supabase),
      collectors: options.collectors ?? createDefaultCollectors(),
      collectorServices,
    },
  );

  if (input.auditType === "public" && outcome.status !== "failed") {
    try {
      const snapshot = await runSearchVisibility({
        auditId: created.runId,
        normalizedUrl: url.normalizedUrl,
        businessName: input.businessName ?? null,
        city: input.city ?? null,
        fetchHomepage: async () => {
          const response = await collectorServices.getHomepage();
          return response ? { bodyText: response.bodyText } : null;
        },
      });
      console.info("[audit/search-visibility] database persistence attempted", { auditId: created.runId });
      await saveSearchVisibilitySnapshot(supabase, created.runId, snapshot);
      console.info("[audit/search-visibility] database persistence succeeded", { auditId: created.runId });
    } catch (error) {
      console.error("[audit/search-visibility] measurement failed", error);
      console.error("[audit/search-visibility] database persistence attempted", { auditId: created.runId, status: "failed" });
      await saveSearchVisibilitySnapshot(supabase, created.runId, {
        status: "failed",
        score: null,
        businessName: input.businessName ?? null,
        city: input.city ?? null,
        state: null,
        locationName: input.city ?? null,
        results: [],
        summary: null,
        errorMessage: error instanceof Error ? error.message : "Search visibility failed.",
        checkedAt: null,
      }).then(
        () => console.info("[audit/search-visibility] database persistence succeeded", { auditId: created.runId, status: "failed" }),
        (saveError) => console.error("[audit/search-visibility] database persistence failed", { auditId: created.runId, error: saveError instanceof Error ? saveError.message : saveError }),
      );
    }
  }

  return {
    ...outcome,
    requestId: created.requestId,
    publicAccessToken: created.publicAccessToken,
  };
}

/**
 * Runs collectors in-process without persisting to the database.
 * Useful for dry-runs and tests.
 */
export async function runCollectorsDryRun(input: {
  rawUrl: string;
  auditType: AuditType;
  tenantId?: string | null;
  collectors?: AuditCollector[];
  collectorServices?: AuditCollectorServices;
}) {
  const url = normalizeAuditUrl(input.rawUrl);
  const scope = buildScope(input.auditType);
  const collectors = input.collectors ?? createDefaultCollectors();
  const services =
    input.collectorServices ??
    createCollectorServices({
      url,
      fetchPage: createSafeFetch(),
      pagespeedClient: createPageSpeedClient(),
      loadTechnicalProfile: async () => null,
    });

  const context = {
    scope,
    url,
    tenantId: input.tenantId ?? null,
    auditRequestId: "dry-run",
    auditRunId: "dry-run",
    services,
  };

  const startedAt = Date.now();
  const results = [];

  for (const collector of collectors.filter((item) => item.supports(scope))) {
    const collectorStarted = Date.now();
    const result = await collector.collect(context);
    results.push({
      collectorKey: collector.key,
      durationMs: Date.now() - collectorStarted,
      findingCount: result.findings.length,
      errorCode: result.errorCode ?? null,
      findings: result.findings,
    });
  }

  return {
    url,
    scope,
    totalDurationMs: Date.now() - startedAt,
    collectors: results,
  };
}
