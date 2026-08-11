import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGoogleSerpScreenshot } from "./client";
import type { SearchVisibilityResult, SearchVisibilitySnapshot } from "./types";

export const MAX_SERP_SCREENSHOTS_PER_AUDIT = Math.min(3, Math.max(0, Number(process.env.MAX_SERP_SCREENSHOTS_PER_AUDIT ?? 3) || 3));
export const SEARCH_EVIDENCE_BUCKET = "audit-search-evidence";

function selectScreenshotResults(results: SearchVisibilityResult[]): SearchVisibilityResult[] {
  const discovery = results.filter((result) => result.type === "discovery" && result.taskId);
  const candidates = discovery.length ? discovery : results.filter((result) => result.taskId);
  if (!candidates.length) return [];
  const byOpportunity = [...candidates].sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1));
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

export async function captureSearchScreenshots(supabase: SupabaseClient, auditRunId: string, snapshot: SearchVisibilitySnapshot): Promise<void> {
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
      results[index] = { ...results[index], screenshotStatus: "available", screenshotStoragePath: path, screenshotCreatedAt: new Date().toISOString(), screenshotSourceTaskId: selected.taskId };
      await supabase.from("audit_search_visibility").update({ results_json: results }).eq("audit_run_id", auditRunId);
      console.info("[audit/search-screenshot] persisted", { auditId: auditRunId, taskId: selected.taskId, query: selected.query, storagePath: path });
    } catch (error) {
      results[index] = { ...results[index], screenshotStatus: "failed", screenshotCreatedAt: new Date().toISOString(), screenshotSourceTaskId: selected.taskId };
      await supabase.from("audit_search_visibility").update({ results_json: results }).eq("audit_run_id", auditRunId);
      console.error("[audit/search-screenshot] failed", { auditId: auditRunId, taskId: selected.taskId, query: selected.query, error: error instanceof Error ? error.message : error });
    }
  }
}
