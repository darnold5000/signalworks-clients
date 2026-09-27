"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { OperationsHealthStatus } from "@/lib/client-health/constants";
import type {
  TenantOperationsHealth,
  TenantOperationsHealthProvider,
} from "@/lib/client-health/types";
import { websiteLabelFromStatus } from "@/lib/client-health/uptimerobot/map-status";
import { Button, Panel, StatusPill } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

function healthTone(
  status: OperationsHealthStatus,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "critical":
      return "danger";
    case "unknown":
      return "warning";
    case "not_configured":
      return "neutral";
  }
}

type MonitorOption = {
  id: string;
  friendly_name: string;
  url: string;
};

export function SystemHealthPanel({
  tenantId,
  initialHealth,
  initialUptimeRobot,
  configuredMonitorId,
}: {
  tenantId: string;
  initialHealth: TenantOperationsHealth | null;
  initialUptimeRobot: TenantOperationsHealthProvider | null;
  configuredMonitorId: string | null;
}) {
  const router = useRouter();
  const [health, setHealth] = useState(initialHealth);
  const [provider, setProvider] = useState(initialUptimeRobot);
  const [monitorId, setMonitorId] = useState(configuredMonitorId ?? "");
  const [monitors, setMonitors] = useState<MonitorOption[]>([]);
  const [monitorsError, setMonitorsError] = useState<string | null>(null);
  const [loadingMonitors, setLoadingMonitors] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingMonitor, setSavingMonitor] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const websiteStatus: OperationsHealthStatus =
    health?.website_status ?? "not_configured";

  const loadMonitors = useCallback(async () => {
    setLoadingMonitors(true);
    setMonitorsError(null);
    const response = await fetch(
      "/api/admin/operations-health/uptimerobot/monitors",
      { credentials: "include" },
    );
    setLoadingMonitors(false);
    const data = (await response.json().catch(() => ({}))) as {
      monitors?: MonitorOption[];
      error?: string;
    };
    if (!response.ok) {
      setMonitorsError(data.error ?? "Could not load UptimeRobot monitors.");
      return;
    }
    setMonitors(data.monitors ?? []);
  }, []);

  useEffect(() => {
    void loadMonitors();
  }, [loadMonitors]);

  async function saveMonitorId(nextId: string) {
    setSavingMonitor(true);
    setActionError(null);
    const response = await fetch(`/api/admin/clients/${tenantId}/technical`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uptime_robot_monitor_id: nextId || null }),
    });
    setSavingMonitor(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setActionError(data.error ?? "Could not save monitor ID.");
      return;
    }
    setMonitorId(nextId);
    router.refresh();
  }

  async function refreshHealth() {
    setRefreshing(true);
    setActionError(null);
    const response = await fetch(
      `/api/admin/clients/${tenantId}/operations-health/refresh`,
      { method: "POST", credentials: "include" },
    );
    setRefreshing(false);
    const data = (await response.json().catch(() => ({}))) as {
      result?: {
        providerStatus: OperationsHealthStatus;
        overallStatus: OperationsHealthStatus;
        error: string | null;
      };
      health?: TenantOperationsHealth | null;
      uptimerobot?: TenantOperationsHealthProvider | null;
      error?: string;
    };
    if (!response.ok) {
      setActionError(data.error ?? "Refresh failed.");
      return;
    }
    if (data.health) setHealth(data.health as typeof health);
    if (data.uptimerobot) setProvider(data.uptimerobot as typeof provider);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            System Health
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Live infrastructure monitoring (UptimeRobot). For SEO and launch
            checks, use{" "}
            <Link
              href="/admin/site-health"
              className="underline underline-offset-2"
            >
              Site Health
            </Link>
            .
          </p>
        </div>
        <Button
          type="button"
          disabled={refreshing}
          onClick={() => void refreshHealth()}
        >
          {refreshing ? "Refreshing…" : "Refresh health"}
        </Button>
      </div>

      {actionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      <Panel title="UptimeRobot monitor">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">
              Map monitor (manual selection)
            </label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
              value={monitorId}
              disabled={loadingMonitors || savingMonitor}
              onChange={(event) => {
                const next = event.target.value;
                setMonitorId(next);
                void saveMonitorId(next);
              }}
            >
              <option value="">— Not linked —</option>
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.friendly_name} · {monitor.url} (#{monitor.id})
                </option>
              ))}
            </select>
            {monitorsError ? (
              <p className="mt-2 text-xs text-red-700">{monitorsError}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Or set the monitor ID under Operations. Mappings are never guessed
              from domain similarity.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Website">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            label={websiteLabelFromStatus(websiteStatus)}
            tone={healthTone(websiteStatus)}
          />
          {health?.overall_status ? (
            <span className="text-xs text-muted">
              Overall: {health.overall_status.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">30-day uptime</dt>
            <dd className="font-medium">
              {health?.website_uptime_30d != null
                ? `${health.website_uptime_30d.toFixed(2)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Response time</dt>
            <dd className="font-medium">
              {health?.website_response_ms != null
                ? `${health.website_response_ms} ms`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Last checked</dt>
            <dd className="font-medium">
              {formatDateTime(
                health?.last_checked_at ??
                  provider?.last_attempt_at ??
                  null,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Monitor ID</dt>
            <dd className="font-medium">{configuredMonitorId ?? "—"}</dd>
          </div>
        </dl>
        {(health?.last_error || provider?.last_error) &&
        (websiteStatus === "unknown" ||
          provider?.status === "unknown") ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {health?.last_error ?? provider?.last_error}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
