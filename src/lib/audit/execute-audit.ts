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
  saveLocalSearchSnapshot,
  saveAeoSnapshot,
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
import { resolveDataForSeoLocation } from "@/lib/audit/search-visibility/client";
import { parseMarketInput } from "@/lib/audit/location-input";
import { runLocalSearch } from "@/lib/audit/local-search/run";
import { analyzeAeoReadiness } from "@/lib/audit/aeo/analyze";
import { captureSearchScreenshots, CLIENT_SCREENSHOT_RETENTION_DAYS, FREE_SCREENSHOT_RETENTION_DAYS } from "@/lib/audit/search-visibility/screenshots";

export type ExecuteAuditInput = {
  rawUrl: string;
  auditType: AuditType;
  tenantId?: string | null;
  businessName?: string | null;
  businessTypeHint?: string | null;
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
    businessTypeHint: input.businessTypeHint,
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
      businessName: input.businessName ?? null,
      market: input.city ?? null,
    },
    {
      persistence: createSupabaseAuditPersistence(supabase),
      collectors: options.collectors ?? createDefaultCollectors(),
      collectorServices,
    },
  );

  if (input.auditType === "public" && outcome.status !== "failed") {
    try {
      const homepage = await collectorServices.getHomepage();
      if (homepage) {
        const aeoSnapshot = analyzeAeoReadiness({ html: homepage.bodyText, businessName: input.businessName ?? null, market: input.city ?? null });
        console.info("[audit/aeo] completed", { auditId: created.runId, score: aeoSnapshot.score, questionCoverage: aeoSnapshot.questionCoverage.answered, profile: aeoSnapshot.evidence.profile });
        await saveAeoSnapshot(supabase, created.runId, aeoSnapshot);
        console.info("[audit/aeo] persistence succeeded", { auditId: created.runId });
      }
    } catch (error) {
      console.error("[audit/aeo] persistence failed", { auditId: created.runId, error: error instanceof Error ? error.message : error });
    }
    let organicSnapshot: Awaited<ReturnType<typeof runSearchVisibility>> | null = null;
    try {
      organicSnapshot = await runSearchVisibility({
        auditId: created.runId,
        normalizedUrl: url.normalizedUrl,
        businessName: input.businessName ?? null,
        businessTypeHint: input.businessTypeHint ?? null,
        city: input.city ?? null,
        fetchHomepage: async () => {
          const response = await collectorServices.getHomepage();
          return response ? { bodyText: response.bodyText } : null;
        },
        supabase,
      });
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Search visibility execution failed.";
      console.error("[audit/search-visibility] execution failed", { auditId: created.runId, phase: "search_visibility_execution", failureCode: "search_visibility_execution_failed", error: failureMessage });
      const failureSnapshot = {
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
        enteredMarket: input.city ?? null,
        locationCode: null,
        auditedDomain: url.normalizedDomain,
        resultDepth: 30,
        searchEngine: "google",
        diagnostics: { failurePhase: "search_visibility_execution", failureCode: "search_visibility_execution_failed", failureMessage, successfulQueryCount: 0, failedQueryCount: 0 },
      } as const;
      await saveSearchVisibilitySnapshot(supabase, created.runId, failureSnapshot).then(
        () => console.info("[audit/search-visibility] failure diagnostic persisted", { auditId: created.runId, phase: failureSnapshot.diagnostics.failurePhase, failureCode: failureSnapshot.diagnostics.failureCode }),
        (saveError) => console.error("[audit/search-visibility] failure diagnostic persistence failed", { auditId: created.runId, phase: "search_visibility_persistence", failureCode: "search_visibility_persistence_failed", error: saveError instanceof Error ? saveError.message : saveError }),
      );
    }

    if (organicSnapshot) {
      try {
        console.info("[audit/search-visibility] database persistence attempted", { auditId: created.runId, measurementStatus: organicSnapshot.status });
        await saveSearchVisibilitySnapshot(supabase, created.runId, organicSnapshot);
        console.info("[audit/search-visibility] database persistence succeeded", { auditId: created.runId, measurementStatus: organicSnapshot.status });
      } catch (error) {
        const failureMessage = error instanceof Error ? error.message : "Search visibility persistence failed.";
        console.error("[audit/search-visibility] measurement succeeded but persistence failed", { auditId: created.runId, phase: "search_visibility_persistence", failureCode: "search_visibility_persistence_failed", measurementStatus: organicSnapshot.status, successfulQueryCount: organicSnapshot.diagnostics?.successfulQueryCount ?? organicSnapshot.results.filter((result) => result.collectionStatus !== "failed").length, failedQueryCount: organicSnapshot.diagnostics?.failedQueryCount ?? organicSnapshot.results.filter((result) => result.collectionStatus === "failed").length, error: failureMessage });
        const persistenceFailureSnapshot = {
          ...organicSnapshot,
          status: "failed" as const,
          score: null,
          errorMessage: `Search visibility measurement completed, but persistence failed: ${failureMessage}`,
          diagnostics: {
            failurePhase: "search_visibility_persistence",
            failureCode: "search_visibility_persistence_failed",
            failureMessage,
            successfulQueryCount: organicSnapshot.diagnostics?.successfulQueryCount ?? organicSnapshot.results.filter((result) => result.collectionStatus !== "failed").length,
            failedQueryCount: organicSnapshot.diagnostics?.failedQueryCount ?? organicSnapshot.results.filter((result) => result.collectionStatus === "failed").length,
          },
        };
        await saveSearchVisibilitySnapshot(supabase, created.runId, persistenceFailureSnapshot).then(
          () => console.info("[audit/search-visibility] persistence failure diagnostic persisted", { auditId: created.runId, phase: "search_visibility_persistence", failureCode: "search_visibility_persistence_failed" }),
          (saveError) => console.error("[audit/search-visibility] persistence failure diagnostic could not be persisted", { auditId: created.runId, phase: "search_visibility_persistence", failureCode: "search_visibility_persistence_failed", error: saveError instanceof Error ? saveError.message : saveError }),
        );
      }
      const screenshotRetentionDays = input.auditType === "public" ? FREE_SCREENSHOT_RETENTION_DAYS : CLIENT_SCREENSHOT_RETENTION_DAYS;
      await captureSearchScreenshots(supabase, created.runId, organicSnapshot, screenshotRetentionDays).catch((error) => console.error("[audit/search-screenshot] preparation failed", { auditId: created.runId, error: error instanceof Error ? error.message : error }));
    }

    try {
      const homepage = await collectorServices.getHomepage();
      const market = parseMarketInput(input.city);
      const locationResolution = await resolveDataForSeoLocation(market);
      if (locationResolution.status !== "resolved") throw new Error(locationResolution.status === "ambiguous" ? `Please enter city and state. Multiple locations matched ${locationResolution.city}: ${locationResolution.candidates.join("; ")}.` : locationResolution.reason);
      const location = locationResolution.location;
      const localSnapshot = await runLocalSearch({
        auditId: created.runId,
        normalizedUrl: url.normalizedUrl,
        businessName: input.businessName ?? null,
        businessTypeHint: input.businessTypeHint ?? null,
        enteredMarket: input.city ?? null,
        city: market.city,
        state: market.state,
        locationCode: location.locationCode,
        locationName: location.locationName,
        homepageText: homepage?.bodyText ?? "",
        discoveryQueries: organicSnapshot?.results.filter((result) => result.type === "discovery").map((result) => result.query) ?? [],
      });
      console.info("[audit/local-search] database persistence attempted", { auditId: created.runId });
      await saveLocalSearchSnapshot(supabase, created.runId, localSnapshot);
      console.info("[audit/local-search] database persistence succeeded", { auditId: created.runId });
    } catch (error) {
      console.error("[audit/local-search] measurement failed", { auditId: created.runId, error: error instanceof Error ? error.message : error });
      await saveLocalSearchSnapshot(supabase, created.runId, { status: "failed", score: null, profileKey: null, enteredMarket: input.city ?? null, normalizedMarket: null, locationName: null, locationCode: null, results: [], summary: null, errorMessage: error instanceof Error ? error.message : "Local search failed.", checkedAt: null, auditedDomain: url.normalizedDomain, resultDepth: 20, searchEngine: "google" }).catch((saveError) => console.error("[audit/local-search] persistence failed", saveError));
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
