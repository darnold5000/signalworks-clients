"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button, Panel, StatusPill } from "@/components/ui";
import {
  currentSiteHealthStatus,
  siteHealthLabel,
  siteHealthTone,
} from "@/lib/site-health/presentation";
import type {
  LaunchChecklistState,
  ManualChecklistKey,
  SiteHealthCheck,
  SiteHealthResult,
  SiteHealthSite,
} from "@/lib/site-health/types";

const MANUAL_ITEMS: Array<{ key: ManualChecklistKey; label: string }> = [
  { key: "dns_ownership_confirmed", label: "DNS ownership confirmed" },
  { key: "search_console_property_created", label: "Search Console property created" },
  { key: "sitemap_submitted", label: "Sitemap submitted in Search Console" },
  { key: "live_url_test_passed", label: "Live URL test passed" },
  { key: "indexing_requested", label: "Indexing requested" },
];

export function SiteHealthDetail({ site }: { site: SiteHealthSite }) {
  const router = useRouter();
  const record = site.record;
  const result = isResult(record?.last_check_results) ? record.last_check_results : null;
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<LaunchChecklistState>(record?.launch_checklist ?? {});
  const [gscStatus, setGscStatus] = useState(record?.search_console_status ?? "not_configured");
  const [gscProperty, setGscProperty] = useState(record?.search_console_property ?? "");
  const status = checking ? "checking" : currentSiteHealthStatus(site.configuredUrl, record?.last_check_status);

  async function runCheck() {
    setChecking(true); setError(null);
    try {
      const response = await fetch(`/api/admin/site-health/${site.tenantId}/check`, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Site check failed.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Site check failed."); }
    finally { setChecking(false); }
  }

  async function saveSettings(nextChecklist = checklist) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/admin/site-health/${site.tenantId}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ launchChecklist: nextChecklist, searchConsoleStatus: gscStatus, searchConsoleProperty: gscProperty || null }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Save failed.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed."); }
    finally { setSaving(false); }
  }

  function toggleChecklist(key: ManualChecklistKey) {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    void saveSettings(next);
  }

  const autoItems = [
    { label: "Production domain connected", done: checkPassed(result, "reachability") },
    { label: "Primary hostname selected", done: checkPassed(result, "redirects") },
    { label: "Alternate hostname redirects correctly", done: checkPassed(result, "www") },
    { label: "Homepage is indexable", done: checkPassed(result, "indexability") },
  ];

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><div className="flex items-center gap-3"><StatusPill label={siteHealthLabel(status)} tone={siteHealthTone(status)} /><span className="text-sm text-muted">{record?.last_checked_at ? `Checked ${new Date(record.last_checked_at).toLocaleString()}` : "Not checked yet"}</span></div><p className="mt-3 break-all text-sm">{site.configuredUrl ?? "No production URL configured in client settings."}</p></div>
          <Button onClick={runCheck} disabled={checking || !site.configuredUrl}><RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} />{checking ? "Checking…" : "Run check"}</Button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Configuration">
          <Definition label="Production URL" value={result?.configuredUrl ?? site.configuredUrl ?? "Not configured"} />
          <Definition label="Final URL after redirects" value={result?.finalUrl ?? "Not checked"} />
          <Definition label="Live canonical URL" value={result?.canonicalUrl ?? "Not found or not checked"} />
          <Definition label="Expected primary" value={result?.primaryHostname ?? site.configuredDomain ?? "Not configured"} />
          <Definition label="Expected www alternate" value={result?.alternateHostname ?? "Derived when checked"} />
          <Definition label="WWW behavior" value={checkSummary(result, "www")} />
          <Definition label="HTTP → HTTPS" value={checkSummary(result, "http_https")} />
          <Definition label="robots.txt" value={result?.robotsUrl ?? "Derived when checked"} />
          <Definition label="XML sitemap" value={result?.sitemapUrl ?? "Derived when checked"} />
          <Definition label="Sitemap URL count" value={result?.sitemapUrlCount != null ? String(result.sitemapUrlCount) : "Not checked"} />
        </Panel>
        <Panel title="Google Search Console">
          <p className="mb-4 text-sm text-muted">Phase 1 records setup state only. It does not scrape Search Console or call Google APIs.</p>
          <label className="block text-sm font-medium">Status<select className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" value={gscStatus} onChange={(event) => setGscStatus(event.target.value as typeof gscStatus)}><option value="not_configured">Not connected</option><option value="manual_setup">Manual setup</option><option value="connected">Connected</option></select></label>
          <label className="mt-4 block text-sm font-medium">Property<input className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" placeholder="sc-domain:example.com" value={gscProperty} onChange={(event) => setGscProperty(event.target.value)} /></label>
          <Button className="mt-4" variant="secondary" disabled={saving} onClick={() => saveSettings()}>{saving ? "Saving…" : "Save Search Console state"}</Button>
        </Panel>
      </div>

      <Panel title="Technical checks">
        {result?.checks.length ? <div className="divide-y divide-border">{result.checks.map((check) => <CheckRow check={check} key={check.key} />)}</div> : <p className="text-sm text-muted">Run a check to collect technical findings.</p>}
      </Panel>

      <Panel title="Launch checklist">
        <p className="mb-4 text-sm text-muted">Technical items update from the latest check. Manual launch steps are saved for this client.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {autoItems.map((item) => <ChecklistItem key={item.label} label={item.label} checked={item.done} disabled />)}
          {MANUAL_ITEMS.map((item) => <ChecklistItem key={item.key} label={item.label} checked={Boolean(checklist[item.key])} disabled={saving} onChange={() => toggleChecklist(item.key)} />)}
        </div>
      </Panel>
    </div>
  );
}

function Definition({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-border py-3 last:border-0"><span className="text-sm text-muted">{label}</span><span className="max-w-[65%] text-right text-sm break-all">{value}</span></div>; }
function ChecklistItem({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange?: () => void }) { return <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="size-4 accent-[var(--color-accent)]" /><span className={checked ? "text-foreground" : "text-muted"}>{label}</span></label>; }
function CheckRow({ check }: { check: SiteHealthCheck }) { const tone = check.state === "pass" ? "success" : check.state === "warning" ? "warning" : check.state === "fail" ? "danger" : "neutral"; return <div className="grid gap-3 py-4 sm:grid-cols-[180px_1fr]"><div><p className="font-medium">{check.label}</p><div className="mt-1"><StatusPill label={check.state.replaceAll("_", " ")} tone={tone} /></div></div><div className="text-sm"><p>{check.explanation}</p>{check.evidence ? <p className="mt-1 break-all text-xs text-muted">{check.evidence}</p> : null}{check.recommendation ? <p className="mt-2 text-warning">Recommended: {check.recommendation}</p> : null}</div></div>; }
function isResult(value: unknown): value is SiteHealthResult { return Boolean(value && typeof value === "object" && Array.isArray((value as SiteHealthResult).checks)); }
function checkPassed(result: SiteHealthResult | null, key: string) { return result?.checks.find((check) => check.key === key)?.state === "pass"; }
function checkSummary(result: SiteHealthResult | null, key: string) { return result?.checks.find((check) => check.key === key)?.explanation ?? "Not checked"; }
