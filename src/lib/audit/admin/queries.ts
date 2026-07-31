import { compareAuditHistory } from "@/lib/audit/history/compare";
import type {
  AuditListItem,
  AuditRunDetail,
  ClientAuditSummary,
} from "@/lib/audit/admin/types";
import type { AuditRunProgress } from "@/lib/audit/types";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

type RunRow = {
  id: string;
  audit_request_id: string;
  tenant_id: string | null;
  status: string;
  overall_score: number | null;
  summary: string | null;
  engine_version: string;
  scope_version: string;
  progress_json: AuditRunProgress;
  created_at: string;
  completed_at: string | null;
  audit_requests: {
    id: string;
    audit_type: string;
    business_name: string | null;
    normalized_domain: string;
    normalized_url: string;
    tenant_id: string | null;
    internal_notes: string | null;
    created_at: string;
  };
};

function needsAttention(run: RunRow, recommendations: Array<{ priority: string; status: string }>) {
  if (run.status === "failed" || run.status === "partially_succeeded") return true;
  return recommendations.some(
    (rec) =>
      (rec.priority === "high" || rec.priority === "critical") &&
      rec.status === "recommended",
  );
}

function mapListItem(
  run: RunRow,
  tenantName: string | null,
  previousScore: number | null,
  recommendations: Array<{ priority: string; status: string }>,
): AuditListItem {
  const score = run.overall_score;
  const scoreChange =
    score != null && previousScore != null
      ? Math.round((score - previousScore) * 100) / 100
      : null;

  return {
    runId: run.id,
    requestId: run.audit_request_id,
    auditType: run.audit_requests.audit_type,
    businessName: run.audit_requests.business_name,
    normalizedDomain: run.audit_requests.normalized_domain,
    normalizedUrl: run.audit_requests.normalized_url,
    tenantId: run.tenant_id,
    tenantName,
    status: run.status,
    overallScore: score,
    previousScore,
    scoreChange,
    createdAt: run.created_at,
    completedAt: run.completed_at,
    needsAttention: needsAttention(run, recommendations),
  };
}

async function loadTenantNames(tenantIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (tenantIds.length === 0) return map;

  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from(TABLES.tenantProfiles)
    .select("tenant_id, display_name, legal_business_name")
    .in("tenant_id", tenantIds);

  for (const profile of profiles ?? []) {
    const name =
      profile.display_name ??
      profile.legal_business_name ??
      profile.tenant_id.slice(0, 8);
    map.set(profile.tenant_id, name);
  }

  return map;
}

export async function listAdminAudits(filters?: {
  tenantId?: string;
  auditType?: string;
  status?: string;
  needsAttention?: boolean;
  minScore?: number;
  maxScore?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AuditListItem[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from(TABLES.auditRuns)
    .select(
      `id, audit_request_id, tenant_id, status, overall_score, summary, engine_version, scope_version, progress_json, created_at, completed_at,
      audit_requests!inner(id, audit_type, business_name, normalized_domain, normalized_url, tenant_id, internal_notes, created_at)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.tenantId) {
    query = query.eq("tenant_id", filters.tenantId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const runs = (data ?? []) as unknown as RunRow[];
  const tenantIds = [...new Set(runs.map((run) => run.tenant_id).filter(Boolean))] as string[];
  const tenantNames = await loadTenantNames(tenantIds);

  const runIds = runs.map((run) => run.id);
  const { data: recommendations } = await supabase
    .from(TABLES.auditRecommendations)
    .select("audit_run_id, priority, status")
    .in("audit_run_id", runIds);

  const recsByRun = new Map<string, Array<{ priority: string; status: string }>>();
  for (const rec of recommendations ?? []) {
    const list = recsByRun.get(rec.audit_run_id) ?? [];
    list.push({ priority: rec.priority, status: rec.status });
    recsByRun.set(rec.audit_run_id, list);
  }

  const items: AuditListItem[] = [];
  const seenDomains = new Map<string, number | null>();

  for (const run of runs) {
    if (filters?.auditType && run.audit_requests.audit_type !== filters.auditType) {
      continue;
    }
    if (filters?.dateFrom && run.created_at < filters.dateFrom) {
      continue;
    }
    if (filters?.dateTo && run.created_at > `${filters.dateTo}T23:59:59.999Z`) {
      continue;
    }
    if (filters?.minScore != null && (run.overall_score ?? -1) < filters.minScore) {
      continue;
    }
    if (filters?.maxScore != null && (run.overall_score ?? 101) > filters.maxScore) {
      continue;
    }

    const domainKey = `${run.tenant_id ?? "public"}:${run.audit_requests.normalized_domain}`;
    const previousScore = seenDomains.get(domainKey) ?? null;
    if (run.overall_score != null) {
      seenDomains.set(domainKey, run.overall_score);
    }

    const item = mapListItem(
      run,
      run.tenant_id ? tenantNames.get(run.tenant_id) ?? null : null,
      previousScore,
      recsByRun.get(run.id) ?? [],
    );

    if (filters?.needsAttention && !item.needsAttention) continue;
    items.push(item);
  }

  return items;
}

async function loadPreviousRun(current: RunRow): Promise<RunRow | null> {
  const supabase = createServiceClient();

  let requestIds: string[] | null = null;
  if (!current.tenant_id) {
    const { data: requests } = await supabase
      .from(TABLES.auditRequests)
      .select("id")
      .eq("normalized_domain", current.audit_requests.normalized_domain)
      .is("tenant_id", null);
    requestIds = (requests ?? []).map((row) => row.id);
    if (requestIds.length === 0) return null;
  }

  let query = supabase
    .from(TABLES.auditRuns)
    .select(
      `id, audit_request_id, tenant_id, status, overall_score, summary, engine_version, scope_version, progress_json, created_at, completed_at,
      audit_requests!inner(id, audit_type, business_name, normalized_domain, normalized_url, tenant_id, internal_notes, created_at)`,
    )
    .neq("id", current.id)
    .lt("created_at", current.created_at)
    .order("created_at", { ascending: false })
    .limit(1);

  if (current.tenant_id) {
    query = query.eq("tenant_id", current.tenant_id);
  } else if (requestIds) {
    query = query.in("audit_request_id", requestIds);
  }

  const { data } = await query.maybeSingle();
  return (data as RunRow | null) ?? null;
}

export async function getAdminAuditRunDetail(runId: string): Promise<AuditRunDetail | null> {
  const supabase = createServiceClient();
  const { data: run, error } = await supabase
    .from(TABLES.auditRuns)
    .select(
      `id, audit_request_id, tenant_id, status, overall_score, summary, engine_version, scope_version, progress_json, created_at, completed_at,
      audit_requests!inner(id, audit_type, business_name, normalized_domain, normalized_url, tenant_id, internal_notes, created_at)`,
    )
    .eq("id", runId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!run) return null;

  const runRow = run as unknown as RunRow;
  const [{ data: findings }, { data: scores }, { data: recommendations }] =
    await Promise.all([
      supabase.from(TABLES.auditFindings).select("*").eq("audit_run_id", runId),
      supabase.from(TABLES.auditScores).select("*").eq("audit_run_id", runId),
      supabase
        .from(TABLES.auditRecommendations)
        .select("*")
        .eq("audit_run_id", runId)
        .order("priority", { ascending: true }),
    ]);

  const tenantNames = runRow.tenant_id
    ? await loadTenantNames([runRow.tenant_id])
    : new Map<string, string>();

  const previousRun = await loadPreviousRun(runRow);
  let history = null;

  if (previousRun) {
    const [{ data: prevFindings }, { data: prevScores }] = await Promise.all([
      supabase
        .from(TABLES.auditFindings)
        .select("check_key, status")
        .eq("audit_run_id", previousRun.id),
      supabase.from(TABLES.auditScores).select("category, score").eq("audit_run_id", previousRun.id),
    ]);

    history = compareAuditHistory({
      currentFindings: (findings ?? []).map((row) => ({
        checkKey: row.check_key,
        status: row.status,
      })),
      previousFindings: (prevFindings ?? []).map((row) => ({
        checkKey: row.check_key,
        status: row.status,
      })),
      currentScores: (scores ?? []).map((row) => ({
        category: row.category,
        score: Number(row.score),
      })),
      previousScores: (prevScores ?? []).map((row) => ({
        category: row.category,
        score: Number(row.score),
      })),
      currentOverall: runRow.overall_score,
      previousOverall: previousRun.overall_score,
      previousRunId: previousRun.id,
      previousCompletedAt: previousRun.completed_at,
    });
  }

  return {
    runId: runRow.id,
    requestId: runRow.audit_request_id,
    auditType: runRow.audit_requests.audit_type,
    businessName: runRow.audit_requests.business_name,
    normalizedDomain: runRow.audit_requests.normalized_domain,
    normalizedUrl: runRow.audit_requests.normalized_url,
    tenantId: runRow.tenant_id,
    tenantName: runRow.tenant_id ? tenantNames.get(runRow.tenant_id) ?? null : null,
    internalNotes: runRow.audit_requests.internal_notes,
    status: runRow.status,
    overallScore: runRow.overall_score,
    summary: runRow.summary,
    engineVersion: runRow.engine_version,
    scopeVersion: runRow.scope_version,
    createdAt: runRow.created_at,
    completedAt: runRow.completed_at,
    progress: (runRow.progress_json ?? { phase: "complete", collectors: {}, updatedAt: runRow.created_at }) as AuditRunProgress,
    findings: (findings ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      checkKey: row.check_key,
      severity: row.severity,
      status: row.status,
      title: row.title,
      summary: row.summary,
      evidenceJson: (row.evidence_json ?? {}) as Record<string, unknown>,
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      isPublic: row.is_public,
      isClientVisible: row.is_client_visible,
    })),
    scores: (scores ?? []).map((row) => ({
      category: row.category,
      score: Number(row.score),
      weight: Number(row.weight),
      findingCount: row.finding_count,
    })),
    recommendations: (recommendations ?? []).map((row) => ({
      id: row.id,
      recommendationKey: row.recommendation_key,
      priority: row.priority,
      title: row.title,
      description: row.description,
      impact: row.impact,
      effort: row.effort,
      signalworksServiceKey: row.signalworks_service_key,
      supportingFindingKeys: (row.supporting_finding_keys ?? []) as string[],
      isPublic: row.is_public,
      isClientVisible: row.is_client_visible,
      status: row.status,
    })),
    history,
  };
}

export async function getClientAuditSummary(tenantId: string): Promise<ClientAuditSummary> {
  const supabase = createServiceClient();
  const { data: runs } = await supabase
    .from(TABLES.auditRuns)
    .select("id, overall_score, completed_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(2);

  const latest = runs?.[0];
  const previous = runs?.[1];

  let highPriorityRecommendations: ClientAuditSummary["highPriorityRecommendations"] = [];
  if (latest) {
    const { data: recs } = await supabase
      .from(TABLES.auditRecommendations)
      .select("id, title, priority, status")
      .eq("audit_run_id", latest.id)
      .in("priority", ["high", "critical"])
      .eq("status", "recommended")
      .limit(5);

    highPriorityRecommendations = (recs ?? []).map((rec) => ({
      id: rec.id,
      title: rec.title,
      priority: rec.priority,
    }));
  }

  const latestScore = latest?.overall_score ?? null;
  const previousScore = previous?.overall_score ?? null;

  return {
    latestRunId: latest?.id ?? null,
    latestScore,
    previousScore,
    scoreChange:
      latestScore != null && previousScore != null
        ? Math.round((latestScore - previousScore) * 100) / 100
        : null,
    lastRunAt: latest?.completed_at ?? latest?.created_at ?? null,
    highPriorityRecommendations,
  };
}

export async function updateRecommendationStatus(
  runId: string,
  recommendationId: string,
  status: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(TABLES.auditRecommendations)
    .update({ status })
    .eq("id", recommendationId)
    .eq("audit_run_id", runId);

  if (error) throw new Error(error.message);
}
