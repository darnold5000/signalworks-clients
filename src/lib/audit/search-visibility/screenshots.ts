import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGoogleSerpScreenshot } from "./client";
import type { SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";

export const MAX_SERP_SCREENSHOTS_PER_AUDIT = Math.min(3, Math.max(0, Number(process.env.MAX_SERP_SCREENSHOTS_PER_AUDIT ?? 3) || 3));
export const SEARCH_EVIDENCE_BUCKET = "audit-search-evidence";
export const FREE_SCREENSHOT_RETENTION_DAYS = Number(process.env.FREE_AUDIT_SCREENSHOT_RETENTION_DAYS ?? 30) || 30;
export const CLIENT_SCREENSHOT_RETENTION_DAYS = Number(process.env.CLIENT_AUDIT_SCREENSHOT_RETENTION_DAYS ?? 365) || 365;

function selectScreenshotResults(results: SearchVisibilityResult[]): SearchVisibilityResult[] {
  const discovery = results.filter((result) => result.type === "discovery" && result.taskId);
  const candidates = discovery.length ? discovery : results.filter((result) => result.taskId);
  if (!candidates.length) return [];
  const byOpportunity = [...candidates].sort((a, b) => {
    const aFailed = a.collectionStatus === "failed" ? 1 : 0;
    const bFailed = b.collectionStatus === "failed" ? 1 : 0;
    if (aFailed !== bFailed) return aFailed - bFailed;
    const aAuthority = a.relevanceSource === "profile_default" ? 1 : 0;
    const bAuthority = b.relevanceSource === "profile_default" ? 1 : 0;
    if (aAuthority !== bAuthority) return aAuthority - bAuthority;
    const aTier = a.relevanceTier ?? 99;
    const bTier = b.relevanceTier ?? 99;
    if (aTier !== bTier) return aTier - bTier;
    return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
  });
  const selected: SearchVisibilityResult[] = [];
  const add = (result: SearchVisibilityResult | undefined) => { if (result && !selected.some((item) => item.query === result.query)) selected.push(result); };
  add(byOpportunity[0]);
  add([...candidates].filter((result) => result.found && result.position != null).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0]);
  add(byOpportunity.find((result) => !selected.some((item) => item.query === result.query)));
  return selected.slice(0, MAX_SERP_SCREENSHOTS_PER_AUDIT);
}

function storageName(auditRunId: string, query: string) {
  return `${auditRunId}/${createHash("sha256").update(query).digest("hex").slice(0, 24)}.png`;
}

export async function captureSearchScreenshots(supabase: SupabaseClient, auditRunId: string, snapshot: SearchVisibilitySnapshot, retentionDays = FREE_SCREENSHOT_RETENTION_DAYS): Promise<void> {
  if (snapshot.status !== "completed" || MAX_SERP_SCREENSHOTS_PER_AUDIT === 0) return;
  const results = snapshot.results.map((result) => ({ ...result }));
  for (const selected of selectScreenshotResults(results)) {
    const index = results.findIndex((result) => result.query === selected.query);
    if (index < 0 || !selected.taskId) continue;
    if (results[index].screenshotStatus === "available") { console.info("[audit/search-screenshot] skipped-existing", { auditId: auditRunId, query: selected.query }); continue; }
    results[index] = { ...results[index], screenshotStatus: "pending", screenshotSourceTaskId: selected.taskId };
    await supabase.from("audit_search_visibility").update({ results_json: results }).eq("audit_run_id", auditRunId);
    console.info("[audit/search-screenshot] selected", { auditId: auditRunId, taskId: selected.taskId, query: selected.query });
    try {
      console.info("[audit/search-screenshot] requested", { auditId: auditRunId, taskId: selected.taskId, query: selected.query });
      const image = await fetchGoogleSerpScreenshot(selected.taskId);
      const path = storageName(auditRunId, selected.query);
      const { error: uploadError } = await supabase.storage.from(SEARCH_EVIDENCE_BUCKET).upload(path, image, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const screenshotCreatedAt = new Date();
      const screenshotExpiresAt = new Date(screenshotCreatedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
      results[index] = { ...results[index], screenshotStatus: "available", screenshotStoragePath: path, screenshotCreatedAt: screenshotCreatedAt.toISOString(), screenshotExpiresAt, screenshotSourceTaskId: selected.taskId };
      await supabase.from("audit_search_visibility").update({ results_json: results }).eq("audit_run_id", auditRunId);
      console.info("[audit/search-screenshot] persisted", { auditId: auditRunId, taskId: selected.taskId, query: selected.query, storagePath: path });
    } catch (error) {
      results[index] = { ...results[index], screenshotStatus: "failed", screenshotCreatedAt: new Date().toISOString(), screenshotSourceTaskId: selected.taskId };
      await supabase.from("audit_search_visibility").update({ results_json: results }).eq("audit_run_id", auditRunId);
      console.error("[audit/search-screenshot] failed", { auditId: auditRunId, taskId: selected.taskId, query: selected.query, error: error instanceof Error ? error.message : error });
    }
  }
}

/** Intended for a scheduled maintenance job; it is not run during public report reads. */
export async function cleanupExpiredSearchScreenshots(supabase: SupabaseClient): Promise<number> {
  const { data: rows, error } = await supabase.from("audit_search_visibility").select("audit_run_id, results_json");
  if (error) throw new Error(error.message);
  let removed = 0;
  for (const row of rows ?? []) {
    const results = (row.results_json ?? []) as SearchVisibilityResult[];
    const expired = results.filter((result) => result.screenshotStoragePath && result.screenshotExpiresAt && new Date(result.screenshotExpiresAt).getTime() <= Date.now());
    if (!expired.length) continue;
    const { error: removeError } = await supabase.storage.from(SEARCH_EVIDENCE_BUCKET).remove(expired.map((result) => result.screenshotStoragePath!).filter(Boolean));
    if (removeError) throw new Error(removeError.message);
    const next = results.map((result) => expired.some((item) => item.query === result.query) ? { ...result, screenshotStatus: "unavailable" as const, screenshotStoragePath: null, screenshotUrl: null } : result);
    const { error: updateError } = await supabase.from("audit_search_visibility").update({ results_json: next }).eq("audit_run_id", row.audit_run_id);
    if (updateError) throw new Error(updateError.message);
    removed += expired.length;
  }
  return removed;
}
