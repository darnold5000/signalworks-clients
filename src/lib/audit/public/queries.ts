import type { AuditRunProgress } from "@/lib/audit/types";
import {
  filterFindingsForPublicAudience,
} from "@/lib/audit/public/visibility";
import { recommendationCategoryForKey } from "@/lib/audit/presentation/recommendation-catalog";
import type { PublicAuditDetail } from "@/lib/audit/public/types";
import type { SearchVisibilityResult } from "@/lib/audit/search-visibility/types";
import { scoreSearchVisibility } from "@/lib/audit/search-visibility/scoring";
import type { LocalSearchResult } from "@/lib/audit/local-search/types";
import { scoreLocalSearch } from "@/lib/audit/local-search/scoring";
import type { AeoSnapshot } from "@/lib/audit/aeo/types";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import { SEARCH_EVIDENCE_BUCKET } from "@/lib/audit/search-visibility/screenshots";
import { dedupeCustomerRecommendations } from "@/lib/audit/presentation/customer";

function isValidToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

export async function getPublicAuditByToken(
  token: string,
): Promise<PublicAuditDetail | null> {
  if (!isValidToken(token)) return null;

  const supabase = createServiceClient();
  const { data: request, error: requestError } = await supabase
    .from(TABLES.auditRequests)
    .select(
      "id, audit_type, business_name, business_type_hint, normalized_domain, normalized_url, tenant_id, created_at",
    )
    .eq("public_access_token", token)
    .eq("audit_type", "public")
    .is("tenant_id", null)
    .maybeSingle();

  if (requestError) throw new Error(requestError.message);
  if (!request) return null;

  const { data: run, error: runError } = await supabase
    .from(TABLES.auditRuns)
    .select(
      "id, status, overall_score, summary, progress_json, created_at, completed_at",
    )
    .eq("audit_request_id", request.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) throw new Error(runError.message);
  if (!run) return null;

  const [{ data: findings }, { data: scores }, { data: recommendations }] =
    await Promise.all([
      supabase.from(TABLES.auditFindings).select("*").eq("audit_run_id", run.id),
      supabase.from(TABLES.auditScores).select("*").eq("audit_run_id", run.id),
      supabase
        .from(TABLES.auditRecommendations)
        .select("*")
        .eq("audit_run_id", run.id)
        .order("priority", { ascending: true }),
    ]);
  const { data: searchVisibility, error: searchVisibilityError } = await supabase
    .from("audit_search_visibility")
    .select("status, score, location_name, results_json, queries_analyzed, first_page_count, top_three_count, positions_11_20_count, positions_21_30_count, not_found_count, best_discovery_query, best_discovery_position, error_message, demand_location_requested, demand_location_canonical, demand_google_ads_location_code, demand_google_ads_location_name, demand_location_status, demand_location_error, demand_provider_request_attempted, demand_provider_http_status, demand_provider_task_status, demand_response_status, demand_parse_status, demand_result_count, demand_persistence_attempted, demand_persistence_status, demand_failure_phase, demand_failure_code, demand_failure_message, failure_phase, failure_code, failure_message, successful_query_count, failed_query_count")
    .eq("audit_run_id", run.id)
    .maybeSingle();
  if (searchVisibilityError) {
    console.error("[audit/search-visibility] public read failed", {
      auditId: run.id,
      message: searchVisibilityError.message,
      code: searchVisibilityError.code,
      hint: searchVisibilityError.hint,
    });
  } else {
    console.info("[audit/search-visibility] public read", { auditId: run.id, populated: Boolean(searchVisibility), status: searchVisibility?.status ?? null, score: searchVisibility?.score ?? null });
  }
  const storedSearchResults = (searchVisibility?.results_json ?? []) as SearchVisibilityResult[];
  const searchResults = await Promise.all(storedSearchResults.map(async (result) => {
    if (result.screenshotStatus !== "available" || !result.screenshotStoragePath || (result.screenshotExpiresAt && new Date(result.screenshotExpiresAt).getTime() <= Date.now())) return { ...result, screenshotUrl: null };
    const { data, error } = await supabase.storage.from(SEARCH_EVIDENCE_BUCKET).createSignedUrl(result.screenshotStoragePath, 3600);
    if (error || !data?.signedUrl) {
      console.error("[audit/search-screenshot] signed URL failed", { auditId: run.id, query: result.query, message: error?.message });
      return { ...result, screenshotUrl: null };
    }
    return { ...result, screenshotUrl: data.signedUrl };
  }));
  const calculatedSearchSummary = scoreSearchVisibility(searchResults);
  const { data: localSearch, error: localSearchError } = await supabase
    .from("audit_local_search_visibility")
    .select("status, score, profile_key, entered_market, normalized_market, location_name, location_code, results_json, queries_analyzed, found_count, top_three_count, top_ten_count, not_found_count, best_position, average_position, error_message, checked_at")
    .eq("audit_run_id", run.id)
    .maybeSingle();
  if (localSearchError) console.error("[audit/local-search] public read failed", { auditId: run.id, message: localSearchError.message, code: localSearchError.code });
  const localResults = (localSearch?.results_json ?? []) as LocalSearchResult[];
  const calculatedLocalSummary = scoreLocalSearch(localResults);
  const { data: aeoReadiness, error: aeoError } = await supabase.from("audit_aeo_readiness").select("score, categories_json, question_coverage_json, findings_json, recommendations_json, evidence_json, checked_at").eq("audit_run_id", run.id).maybeSingle();
  if (aeoError) console.error("[audit/aeo] public read failed", { auditId: run.id, message: aeoError.message, code: aeoError.code });

  const mappedFindings = (findings ?? []).map((row) => ({
    category: row.category,
    checkKey: row.check_key,
    severity: row.severity,
    status: row.status,
    title: row.title,
    summary: row.summary,
    sourceLabel: row.source_label,
    isPublic: row.is_public,
    sourceType: row.source_type,
  }));

  const publicFindings = filterFindingsForPublicAudience(mappedFindings);

  const publicRecommendations = dedupeCustomerRecommendations((recommendations ?? [])
    .filter((row) => row.is_public)
    .map((row) => ({
      recommendationKey: row.recommendation_key,
      category: recommendationCategoryForKey(row.recommendation_key),
      priority: row.priority,
      title: row.title,
      description: row.description,
      impact: row.impact,
      effort: row.effort,
      signalworksServiceKey: row.signalworks_service_key,
    })));

  return {
    token,
    runId: run.id,
    status: run.status,
    businessName: request.business_name,
    businessTypeHint: request.business_type_hint ?? null,
    normalizedDomain: request.normalized_domain,
    normalizedUrl: request.normalized_url,
    overallScore: run.overall_score,
    summary: run.summary,
    completedAt: run.completed_at,
    createdAt: run.created_at,
    progress: (run.progress_json ?? {
      phase: "complete",
      collectors: {},
      updatedAt: run.created_at,
    }) as AuditRunProgress,
    scores: (scores ?? []).map((row) => ({
      category: row.category,
      score: Number(row.score),
      weight: Number(row.weight),
    })),
    findings: publicFindings.map((finding) => ({
      category: finding.category,
      checkKey: finding.checkKey,
      severity: finding.severity,
      status: finding.status,
      title: finding.title,
      summary: finding.summary,
      sourceLabel: finding.sourceLabel,
    })),
    recommendations: publicRecommendations,
    searchVisibility: searchVisibility
      ? {
          status: searchVisibility.status,
          score: searchVisibility.score == null ? null : Number(searchVisibility.score),
          locationName: searchVisibility.location_name,
          demandLocation: {
            requested: searchVisibility.demand_location_requested,
            canonical: searchVisibility.demand_location_canonical,
            status: searchVisibility.demand_location_status,
            googleAdsLocationCode: searchVisibility.demand_google_ads_location_code,
            googleAdsLocationName: searchVisibility.demand_google_ads_location_name,
            error: searchVisibility.demand_location_error,
          },
          errorMessage: searchVisibility.error_message,
          searchDemandDiagnostics: {
            providerRequestAttempted: searchVisibility.demand_provider_request_attempted ?? false,
            providerHttpStatus: searchVisibility.demand_provider_http_status,
            providerTaskStatus: searchVisibility.demand_provider_task_status,
            responseStatus: searchVisibility.demand_response_status ?? "not_attempted",
            parseStatus: searchVisibility.demand_parse_status ?? "not_attempted",
            resultCount: searchVisibility.demand_result_count,
            persistenceAttempted: searchVisibility.demand_persistence_attempted ?? false,
            persistenceStatus: searchVisibility.demand_persistence_status ?? "not_attempted",
            failurePhase: searchVisibility.demand_failure_phase,
            failureCode: searchVisibility.demand_failure_code,
            failureMessage: searchVisibility.demand_failure_message,
          },
          diagnostics: {
            failurePhase: searchVisibility.failure_phase,
            failureCode: searchVisibility.failure_code,
            failureMessage: searchVisibility.failure_message,
            successfulQueryCount: searchVisibility.successful_query_count ?? 0,
            failedQueryCount: searchVisibility.failed_query_count ?? 0,
          },
          results: searchResults,
          summary: {
            score: searchVisibility.score == null ? 0 : Number(searchVisibility.score),
            discoveryScore: calculatedSearchSummary.discoveryScore,
            brandedScore: calculatedSearchSummary.brandedScore,
            discoveryQueriesAnalyzed: calculatedSearchSummary.discoveryQueriesAnalyzed,
            brandedQueriesAnalyzed: calculatedSearchSummary.brandedQueriesAnalyzed,
            queriesAnalyzed: searchVisibility.queries_analyzed,
            topThreeCount: searchVisibility.top_three_count,
            firstPageCount: searchVisibility.first_page_count,
            positions11To20Count: searchVisibility.positions_11_20_count,
            positions21To30Count: searchVisibility.positions_21_30_count,
            notFoundCount: searchVisibility.not_found_count,
            bestDiscoveryQuery: searchVisibility.best_discovery_query,
            bestDiscoveryPosition: searchVisibility.best_discovery_position,
          },
        }
      : null,
    localSearch: localSearch
      ? {
          status: localSearch.status,
          score: localSearch.score == null ? null : Number(localSearch.score),
          profileKey: localSearch.profile_key,
          enteredMarket: localSearch.entered_market,
          normalizedMarket: localSearch.normalized_market,
          locationName: localSearch.location_name,
          locationCode: localSearch.location_code,
          results: localResults,
          summary: localSearch.status === "completed" ? calculatedLocalSummary : null,
          errorMessage: localSearch.error_message,
        }
      : null,
    aeoReadiness: aeoReadiness ? {
      score: Number(aeoReadiness.score),
      categories: (aeoReadiness.categories_json ?? []) as AeoSnapshot["categories"],
      questionCoverage: aeoReadiness.question_coverage_json as AeoSnapshot["questionCoverage"],
      findings: (aeoReadiness.findings_json ?? []) as AeoSnapshot["findings"],
      recommendations: (aeoReadiness.recommendations_json ?? []) as AeoSnapshot["recommendations"],
      evidence: (aeoReadiness.evidence_json ?? {}) as Record<string, unknown>,
      checkedAt: aeoReadiness.checked_at,
    } : null,
  };
}
