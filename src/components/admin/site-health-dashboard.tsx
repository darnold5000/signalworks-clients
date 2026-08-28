"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button, Panel, StatusPill } from "@/components/ui";
import {
  currentSiteHealthStatus,
  siteHealthLabel,
  siteHealthTone,
} from "@/lib/site-health/presentation";
import type { SiteCheckState, SiteHealthResult, SiteHealthSite, SiteHealthStatus } from "@/lib/site-health/types";

export function SiteHealthDashboard({
  sites,
  excludedView,
}: {
  sites: SiteHealthSite[];
  excludedView: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [checkingAll, setCheckingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runOne(tenantId: string) {
    setError(null);
    setChecking((current) => new Set(current).add(tenantId));
    try {
      const response = await fetch(`/api/admin/site-health/${tenantId}/check`, { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Site check failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Site check failed.");
    } finally {
      setChecking((current) => {
        const next = new Set(current);
        next.delete(tenantId);
        return next;
      });
    }
  }

  async function runAll() {
    setCheckingAll(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/site-health/check-all", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Site checks failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Site checks failed.");
    } finally {
      setCheckingAll(false);
    }
  }

  async function resumeMonitoring(tenantId: string) {
    setError(null);
    try {
      const response = await fetch(`/api/admin/site-health/${tenantId}/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monitoringEnabled: true }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not resume monitoring.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resume monitoring.");
    }
  }

  const counts = sites.reduce<Record<SiteHealthStatus, number>>(
    (acc, site) => {
      const status = currentSiteHealthStatus(site.configuredUrl, site.record?.last_check_status);
      acc[status] += 1;
      return acc;
    },
    { healthy: 0, needs_attention: 0, not_configured: 0, checking: 0, error: 0 },
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        {(["healthy", "needs_attention", "not_configured", "error"] as const).map((status) => (
          <Panel key={status} className="min-w-36 flex-1 py-4">
            <p className="text-xs tracking-wide text-muted uppercase">{siteHealthLabel(status)}</p>
            <p className="mt-1 font-display text-2xl">{counts[status]}</p>
          </Panel>
        ))}
      </div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm">
          <Link className={!excludedView ? "font-medium text-accent" : "text-muted"} href="/admin/site-health">Monitored sites</Link>
          <Link className={excludedView ? "font-medium text-accent" : "text-muted"} href="/admin/site-health?view=excluded">Excluded sites</Link>
        </div>
        {!excludedView ? <Button onClick={runAll} disabled={checkingAll || sites.length === 0}>
          <RefreshCw className={`size-4 ${checkingAll ? "animate-spin" : ""}`} />
          {checkingAll ? "Checking all…" : "Check all sites"}
        </Button> : null}
      </div>
      {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[1320px] text-left text-sm">
          <thead className="border-b border-border bg-background text-xs tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-3">Site</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Overall</th><th className="px-3 py-3">HTTPS</th><th className="px-3 py-3">Canonical</th><th className="px-3 py-3">Sitemap</th><th className="px-3 py-3">Robots</th><th className="px-3 py-3">Indexable</th><th className="px-3 py-3">Structured</th><th className="px-4 py-3">Search Console</th><th className="px-4 py-3">Last Checked</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const isChecking = checking.has(site.tenantId) || checkingAll;
              const status = isChecking ? "checking" : currentSiteHealthStatus(site.configuredUrl, site.record?.last_check_status);
              const result = isResult(site.record?.last_check_results) ? site.record.last_check_results : null;
              return (
                <tr key={site.tenantId} className="border-b border-border last:border-0">
                  <td className="px-4 py-4"><Link className="font-medium hover:text-accent" href={`/admin/site-health/${site.tenantId}`}>{site.name}</Link>{site.associatedTenants.length > 1 ? <p className="mt-1 text-xs text-muted">{site.associatedTenants.length} associated tenants</p> : null}</td>
                  <td className="max-w-48 px-4 py-4 text-xs break-all text-muted">{domainFor(site)}{site.isPlatformHostedDomain ? <span className="mt-1 block text-muted">Platform-hosted production domain</span> : null}</td>
                  <td className="px-4 py-4"><StatusPill label={siteHealthLabel(status)} tone={siteHealthTone(status)} /></td>
                  <CheckCell state={checkState(result, "reachability")} />
                  <CheckCell state={checkState(result, "canonical")} />
                  <CheckCell state={checkState(result, "sitemap")} suffix={result?.sitemapUrlCount != null ? String(result.sitemapUrlCount) : undefined} />
                  <CheckCell state={checkState(result, "robots")} />
                  <CheckCell state={checkState(result, "indexability")} />
                  <CheckCell state={checkState(result, "structured_data")} />
                  <td className="px-4 py-4 capitalize text-muted">{(site.record?.search_console_status ?? "not_configured").replaceAll("_", " ")}</td>
                  <td className="px-4 py-4 text-xs text-muted">{site.record?.last_checked_at ? new Date(site.record.last_checked_at).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2">{excludedView ? <Button variant="secondary" onClick={() => resumeMonitoring(site.tenantId)}>Monitor in Site Health</Button> : site.configuredUrl ? <Button variant="secondary" disabled={isChecking} onClick={() => runOne(site.tenantId)}>{isChecking ? "Checking…" : "Run check"}</Button> : <Link className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm" href={`/admin/site-health/${site.tenantId}#configuration`}>Configure Site</Link>}<Link className="inline-flex items-center gap-1 px-2 text-sm text-accent" href={`/admin/site-health/${site.tenantId}`}>Details <ExternalLink className="size-3.5" /></Link></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sites.length === 0 ? <p className="p-8 text-center text-sm text-muted">{excludedView ? "No sites are excluded from monitoring." : "No monitored sites are available."}</p> : null}
      </Panel>
    </>
  );
}

function isResult(value: unknown): value is SiteHealthResult {
  return Boolean(value && typeof value === "object" && Array.isArray((value as SiteHealthResult).checks));
}

function checkState(result: SiteHealthResult | null, key: string): SiteCheckState | null {
  return result?.checks.find((check) => check.key === key)?.state ?? null;
}

function CheckCell({ state, suffix }: { state: SiteCheckState | null; suffix?: string }) {
  const symbol = state === "pass" ? "✓" : state === "warning" ? "!" : state === "fail" ? "×" : "—";
  const className = state === "pass" ? "text-success" : state === "warning" ? "text-warning" : state === "fail" ? "text-danger" : "text-muted";
  return <td className={`px-3 py-4 text-center font-semibold ${className}`} title={state?.replaceAll("_", " ") ?? "Not checked"}>{symbol}{suffix ? <span className="ml-1 text-xs font-normal">{suffix}</span> : null}</td>;
}

function domainFor(site: SiteHealthSite) {
  if (site.configuredDomain) return site.configuredDomain;
  if (!site.configuredUrl) return "Not configured";
  try { return new URL(site.configuredUrl).hostname; } catch { return site.configuredUrl; }
}
