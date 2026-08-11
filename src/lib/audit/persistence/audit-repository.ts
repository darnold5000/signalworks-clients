import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_ENGINE_VERSION } from "@/lib/audit/constants";
import { TABLES } from "@/lib/supabase/tables";
import type {
  AuditCollectorResult,
  AuditRunPersistence,
  AuditRunProgress,
  AuditScope,
  NormalizedAuditUrl,
} from "@/lib/audit/types";
import type { LocalSearchSnapshot } from "@/lib/audit/local-search/types";
import type { AeoSnapshot } from "@/lib/audit/aeo/types";
import type { GeneratedRecommendation } from "@/lib/audit/recommendations/generate";
import type { CategoryScoreResult } from "@/lib/audit/scoring/score-audit";
import type { SearchVisibilitySnapshot } from "@/lib/audit/search-visibility/types";

export type CreateAuditRunInput = {
  auditType: AuditScope["auditType"];
  scopeVersion: string;
  tenantId: string | null;
  url: NormalizedAuditUrl;
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

export type CreatedAuditExecution = {
  requestId: string;
  runId: string;
  publicAccessToken: string;
};

export async function createAuditExecution(
  supabase: SupabaseClient,
  input: CreateAuditRunInput,
): Promise<CreatedAuditExecution> {
  const { data: request, error: requestError } = await supabase
    .from(TABLES.auditRequests)
    .insert({
      tenant_id: input.tenantId,
      audit_type: input.auditType,
      requested_url: input.url.input,
      normalized_url: input.url.normalizedUrl,
      normalized_domain: input.url.normalizedDomain,
      business_name: input.businessName ?? null,
      business_type_hint: input.businessTypeHint?.trim() || null,
      business_type_hint_normalized: input.businessTypeHint?.trim().toLowerCase().replace(/\s+/g, " ") || null,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      city: input.city ?? null,
      source: input.source ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      requested_by_user_id: input.requestedByUserId ?? null,
      internal_notes: input.internalNotes ?? null,
      status: "pending",
    })
    .select("id, public_access_token")
    .single();

  if (requestError || !request) {
    throw new Error(requestError?.message ?? "Failed to create audit request.");
  }

  const { data: run, error: runError } = await supabase
    .from(TABLES.auditRuns)
    .insert({
      audit_request_id: request.id,
      tenant_id: input.tenantId,
      status: "queued",
      engine_version: AUDIT_ENGINE_VERSION,
      scope_version: input.scopeVersion,
      progress_json: {},
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Failed to create audit run.");
  }

  return {
    requestId: request.id,
    runId: run.id,
    publicAccessToken: request.public_access_token,
  };
}

export function createSupabaseAuditPersistence(
  supabase: SupabaseClient,
): AuditRunPersistence {
  return {
    async markRunning(runId) {
      const { error } = await supabase
        .from(TABLES.auditRuns)
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", runId);

      if (error) throw new Error(error.message);
    },

    async saveProgress(runId, progress: AuditRunProgress) {
      const { error } = await supabase
        .from(TABLES.auditRuns)
        .update({ progress_json: progress })
        .eq("id", runId);

      if (error) throw new Error(error.message);
    },

    async saveCollectorFindings(runId, tenantId, result: AuditCollectorResult) {
      if (result.findings.length === 0) return;

      const rows = result.findings.map((finding) => ({
        audit_run_id: runId,
        tenant_id: tenantId,
        category: finding.category,
        check_key: finding.checkKey,
        severity: finding.severity,
        status: finding.status,
        score: finding.score ?? null,
        title: finding.title,
        summary: finding.summary,
        evidence_json: finding.evidenceJson ?? {},
        source_type: finding.sourceType,
        source_label: finding.sourceLabel,
        is_public: finding.isPublic ?? false,
        is_client_visible: finding.isClientVisible ?? true,
      }));

      const { error } = await supabase.from(TABLES.auditFindings).insert(rows);
      if (error) throw new Error(error.message);
    },

    async saveCategoryScores(runId, scores: CategoryScoreResult[]) {
      if (scores.length === 0) return;

      const rows = scores.map((row) => ({
        audit_run_id: runId,
        category: row.category,
        score: row.score,
        weight: row.weight,
        finding_count: row.scorableFindingCount,
      }));

      const { error } = await supabase.from(TABLES.auditScores).insert(rows);
      if (error) throw new Error(error.message);
    },

    async saveRecommendations(
      runId,
      recommendations: GeneratedRecommendation[],
    ) {
      if (recommendations.length === 0) return;

      const rows = recommendations.map((recommendation) => ({
        audit_run_id: runId,
        recommendation_key: recommendation.recommendationKey,
        priority: recommendation.priority,
        title: recommendation.title,
        description: recommendation.description,
        impact: recommendation.impact,
        effort: recommendation.effort,
        signalworks_service_key: recommendation.signalworksServiceKey,
        supporting_finding_keys: recommendation.supportingFindingKeys,
        is_public: recommendation.isPublic,
        is_client_visible: recommendation.isClientVisible,
        status: "recommended",
      }));

      const { error } = await supabase.from(TABLES.auditRecommendations).insert(rows);
      if (error) throw new Error(error.message);
    },

    async completeRun(runId, input) {
      const { error } = await supabase
        .from(TABLES.auditRuns)
        .update({
          status: input.status,
          overall_score: input.overallScore,
          summary: input.summary,
          progress_json: input.progress,
          completed_at: new Date().toISOString(),
          error_code: input.errorCode ?? null,
          error_message_internal: input.errorMessageInternal ?? null,
        })
        .eq("id", runId);

      if (error) throw new Error(error.message);
    },

    async markRequestStatus(requestId, status) {
      const { error } = await supabase
        .from(TABLES.auditRequests)
        .update({ status })
        .eq("id", requestId);

      if (error) throw new Error(error.message);
    },
  };
}

export async function saveSearchVisibilitySnapshot(
  supabase: SupabaseClient,
  auditRunId: string,
  snapshot: SearchVisibilitySnapshot,
): Promise<void> {
  const summary = snapshot.summary;
  const { error } = await supabase.from("audit_search_visibility").upsert({
    audit_run_id: auditRunId,
    status: snapshot.status,
    score: snapshot.score,
    business_name: snapshot.businessName,
    city: snapshot.city,
    state: snapshot.state,
    location_name: snapshot.locationName,
    queries_analyzed: summary?.queriesAnalyzed ?? 0,
    first_page_count: summary?.firstPageCount ?? 0,
    top_three_count: summary?.topThreeCount ?? 0,
    positions_11_20_count: summary?.positions11To20Count ?? 0,
    positions_21_30_count: summary?.positions21To30Count ?? 0,
    not_found_count: summary?.notFoundCount ?? 0,
    best_discovery_query: summary?.bestDiscoveryQuery ?? null,
    best_discovery_position: summary?.bestDiscoveryPosition ?? null,
    results_json: snapshot.results,
    error_message: snapshot.errorMessage ?? null,
    checked_at: snapshot.checkedAt,
    entered_market: snapshot.enteredMarket,
    location_code: snapshot.locationCode,
    audited_domain: snapshot.auditedDomain,
    result_depth: snapshot.resultDepth,
    search_engine: snapshot.searchEngine,
    demand_location_requested: snapshot.demandLocation?.requested ?? null,
    demand_location_canonical: snapshot.demandLocation?.canonical ?? null,
    demand_google_ads_location_code: snapshot.demandLocation?.googleAdsLocationCode ?? null,
    demand_google_ads_location_name: snapshot.demandLocation?.googleAdsLocationName ?? null,
    demand_location_status: snapshot.demandLocation?.status ?? null,
    demand_location_error: snapshot.demandLocation?.error ?? null,
  }, { onConflict: "audit_run_id" });
  if (error) throw new Error(error.message);
}

export async function saveLocalSearchSnapshot(
  supabase: SupabaseClient,
  auditRunId: string,
  snapshot: LocalSearchSnapshot,
): Promise<void> {
  const summary = snapshot.summary;
  const { error } = await supabase.from("audit_local_search_visibility").upsert({
    audit_run_id: auditRunId,
    status: snapshot.status,
    score: snapshot.score,
    profile_key: snapshot.profileKey,
    entered_market: snapshot.enteredMarket,
    normalized_market: snapshot.normalizedMarket,
    location_name: snapshot.locationName,
    location_code: snapshot.locationCode,
    queries_analyzed: summary?.queriesAnalyzed ?? 0,
    found_count: summary?.foundCount ?? 0,
    top_three_count: summary?.topThreeCount ?? 0,
    top_ten_count: summary?.topTenCount ?? 0,
    not_found_count: summary?.notFoundCount ?? 0,
    best_position: summary?.bestPosition ?? null,
    average_position: summary?.averagePosition ?? null,
    results_json: snapshot.results,
    error_message: snapshot.errorMessage ?? null,
    checked_at: snapshot.checkedAt,
    audited_domain: snapshot.auditedDomain,
    result_depth: snapshot.resultDepth,
    search_engine: snapshot.searchEngine,
  }, { onConflict: "audit_run_id" });
  if (error) throw new Error(error.message);
}

export async function saveAeoSnapshot(supabase: SupabaseClient, auditRunId: string, snapshot: AeoSnapshot): Promise<void> {
  const { error } = await supabase.from("audit_aeo_readiness").upsert({ audit_run_id: auditRunId, score: snapshot.score, categories_json: snapshot.categories, question_coverage_json: snapshot.questionCoverage, findings_json: snapshot.findings, recommendations_json: snapshot.recommendations, evidence_json: snapshot.evidence, checked_at: snapshot.checkedAt }, { onConflict: "audit_run_id" });
  if (error) throw new Error(error.message);
}
