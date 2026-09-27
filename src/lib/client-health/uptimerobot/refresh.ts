import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationsHealthStatus } from "@/lib/client-health/constants";
import { rollupOperationsHealthStatus } from "@/lib/client-health/rollup";
import type {
  TenantOperationsHealth,
  TenantOperationsHealthProvider,
} from "@/lib/client-health/types";
import {
  buildUptimeRobotSnapshot,
  mapUptimeRobotMonitorStatus,
} from "@/lib/client-health/uptimerobot/map-status";
import type { UptimeRobotFetchFn } from "@/lib/client-health/uptimerobot/types";
import { TABLES } from "@/lib/supabase/tables";

export type UptimeRobotRefreshResult = {
  tenantId: string;
  providerStatus: OperationsHealthStatus;
  overallStatus: OperationsHealthStatus;
  error: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function loadMonitorId(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.tenantTechnicalProfiles)
    .select("uptime_robot_monitor_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const raw = data?.uptime_robot_monitor_id;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function upsertProviderRow(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    status: OperationsHealthStatus;
    lastAttemptAt: string;
    lastSuccessAt: string | null;
    lastError: string | null;
    snapshot: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.tenantOperationsHealthProviders)
    .upsert(
      {
        tenant_id: tenantId,
        provider: "uptimerobot",
        status: input.status,
        last_attempt_at: input.lastAttemptAt,
        last_success_at: input.lastSuccessAt,
        last_error: input.lastError,
        snapshot: input.snapshot,
      },
      { onConflict: "tenant_id,provider" },
    );

  if (error) throw new Error(error.message);
}

async function listProviderStatuses(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<OperationsHealthStatus[]> {
  const { data, error } = await supabase
    .from(TABLES.tenantOperationsHealthProviders)
    .select("status")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row) => row.status as OperationsHealthStatus,
  );
}

async function upsertOperationsHealthFromUptimeRobot(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    websiteStatus: OperationsHealthStatus;
    websiteResponseMs: number | null;
    websiteUptime24h: number | null;
    websiteUptime7d: number | null;
    websiteUptime30d: number | null;
    lastCheckedAt: string;
    lastError: string | null;
    overallStatus: OperationsHealthStatus;
  },
): Promise<void> {
  const { error } = await supabase.from(TABLES.tenantOperationsHealth).upsert(
    {
      tenant_id: tenantId,
      overall_status: input.overallStatus,
      website_status: input.websiteStatus,
      website_response_ms: input.websiteResponseMs,
      website_uptime_24h: input.websiteUptime24h,
      website_uptime_7d: input.websiteUptime7d,
      website_uptime_30d: input.websiteUptime30d,
      last_checked_at: input.lastCheckedAt,
      last_error: input.lastError,
    },
    { onConflict: "tenant_id" },
  );

  if (error) throw new Error(error.message);
}

export async function refreshUptimeRobotHealthForTenant(
  tenantId: string,
  supabase: SupabaseClient,
  fetchMonitors: UptimeRobotFetchFn,
): Promise<UptimeRobotRefreshResult> {
  const attemptedAt = nowIso();
  const monitorId = await loadMonitorId(supabase, tenantId);

  if (!monitorId) {
    await upsertProviderRow(supabase, tenantId, {
      status: "not_configured",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: null,
      lastError: null,
      snapshot: buildUptimeRobotSnapshot(null, null),
    });
    const overallStatus = rollupOperationsHealthStatus(
      await listProviderStatuses(supabase, tenantId),
    );
    await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
      websiteStatus: "not_configured",
      websiteResponseMs: null,
      websiteUptime24h: null,
      websiteUptime7d: null,
      websiteUptime30d: null,
      lastCheckedAt: attemptedAt,
      lastError: null,
      overallStatus,
    });
    return {
      tenantId,
      providerStatus: "not_configured",
      overallStatus,
      error: null,
    };
  }

  const apiResult = await fetchMonitors([monitorId]);

  if (!apiResult.ok) {
    await upsertProviderRow(supabase, tenantId, {
      status: "unknown",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: null,
      lastError: apiResult.error,
      snapshot: buildUptimeRobotSnapshot(null, monitorId),
    });
    const overallStatus = rollupOperationsHealthStatus(
      await listProviderStatuses(supabase, tenantId),
    );
    await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
      websiteStatus: "unknown",
      websiteResponseMs: null,
      websiteUptime24h: null,
      websiteUptime7d: null,
      websiteUptime30d: null,
      lastCheckedAt: attemptedAt,
      lastError: apiResult.error,
      overallStatus,
    });
    return {
      tenantId,
      providerStatus: "unknown",
      overallStatus,
      error: apiResult.error,
    };
  }

  const monitor =
    apiResult.monitors.find((m) => m.id === monitorId) ?? null;

  if (!monitor) {
    const error = "Monitor not found in UptimeRobot account.";
    await upsertProviderRow(supabase, tenantId, {
      status: "unknown",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: null,
      lastError: error,
      snapshot: buildUptimeRobotSnapshot(null, monitorId),
    });
    const overallStatus = rollupOperationsHealthStatus(
      await listProviderStatuses(supabase, tenantId),
    );
    await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
      websiteStatus: "unknown",
      websiteResponseMs: null,
      websiteUptime24h: null,
      websiteUptime7d: null,
      websiteUptime30d: null,
      lastCheckedAt: attemptedAt,
      lastError: error,
      overallStatus,
    });
    return {
      tenantId,
      providerStatus: "unknown",
      overallStatus,
      error,
    };
  }

  const providerStatus = mapUptimeRobotMonitorStatus(monitor.status);
  const successAt = attemptedAt;

  await upsertProviderRow(supabase, tenantId, {
    status: providerStatus,
    lastAttemptAt: attemptedAt,
    lastSuccessAt: successAt,
    lastError: null,
    snapshot: buildUptimeRobotSnapshot(monitor, monitorId),
  });

  const overallStatus = rollupOperationsHealthStatus(
    await listProviderStatuses(supabase, tenantId),
  );

  await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
    websiteStatus: providerStatus,
    websiteResponseMs: monitor.average_response_time,
    websiteUptime24h: monitor.uptime_ratio_24h,
    websiteUptime7d: monitor.uptime_ratio_7d,
    websiteUptime30d: monitor.uptime_ratio_30d,
    lastCheckedAt: successAt,
    lastError: null,
    overallStatus,
  });

  return {
    tenantId,
    providerStatus,
    overallStatus,
    error: null,
  };
}

export async function refreshUptimeRobotHealthForAllConfiguredTenants(
  supabase: SupabaseClient,
  fetchMonitors: UptimeRobotFetchFn,
): Promise<UptimeRobotRefreshResult[]> {
  const { data, error } = await supabase
    .from(TABLES.tenantTechnicalProfiles)
    .select("tenant_id, uptime_robot_monitor_id")
    .not("uptime_robot_monitor_id", "is", null);

  if (error) throw new Error(error.message);

  const tenants = (data ?? []).filter((row) => {
    const id = String(row.uptime_robot_monitor_id ?? "").trim();
    return id.length > 0;
  });

  if (tenants.length === 0) return [];

  const listResult = await fetchMonitors();
  const monitorById = new Map(
    listResult.ok
      ? listResult.monitors.map((m) => [m.id, m] as const)
      : [],
  );

  const results: UptimeRobotRefreshResult[] = [];
  const attemptedAt = nowIso();

  for (const row of tenants) {
    const tenantId = row.tenant_id as string;
    const monitorId = String(row.uptime_robot_monitor_id).trim();

    if (!listResult.ok) {
      await upsertProviderRow(supabase, tenantId, {
        status: "unknown",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: null,
        lastError: listResult.error,
        snapshot: buildUptimeRobotSnapshot(null, monitorId),
      });
      const overallStatus = rollupOperationsHealthStatus(
        await listProviderStatuses(supabase, tenantId),
      );
      await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
        websiteStatus: "unknown",
        websiteResponseMs: null,
        websiteUptime24h: null,
        websiteUptime7d: null,
        websiteUptime30d: null,
        lastCheckedAt: attemptedAt,
        lastError: listResult.error,
        overallStatus,
      });
      results.push({
        tenantId,
        providerStatus: "unknown",
        overallStatus,
        error: listResult.error,
      });
      continue;
    }

    const monitor = monitorById.get(monitorId) ?? null;
    if (!monitor) {
      const notFoundError = "Monitor not found in UptimeRobot account.";
      await upsertProviderRow(supabase, tenantId, {
        status: "unknown",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: null,
        lastError: notFoundError,
        snapshot: buildUptimeRobotSnapshot(null, monitorId),
      });
      const overallStatus = rollupOperationsHealthStatus(
        await listProviderStatuses(supabase, tenantId),
      );
      await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
        websiteStatus: "unknown",
        websiteResponseMs: null,
        websiteUptime24h: null,
        websiteUptime7d: null,
        websiteUptime30d: null,
        lastCheckedAt: attemptedAt,
        lastError: notFoundError,
        overallStatus,
      });
      results.push({
        tenantId,
        providerStatus: "unknown",
        overallStatus,
        error: notFoundError,
      });
      continue;
    }

    const providerStatus = mapUptimeRobotMonitorStatus(monitor.status);
    await upsertProviderRow(supabase, tenantId, {
      status: providerStatus,
      lastAttemptAt: attemptedAt,
      lastSuccessAt: attemptedAt,
      lastError: null,
      snapshot: buildUptimeRobotSnapshot(monitor, monitorId),
    });
    const overallStatus = rollupOperationsHealthStatus(
      await listProviderStatuses(supabase, tenantId),
    );
    await upsertOperationsHealthFromUptimeRobot(supabase, tenantId, {
      websiteStatus: providerStatus,
      websiteResponseMs: monitor.average_response_time,
      websiteUptime24h: monitor.uptime_ratio_24h,
      websiteUptime7d: monitor.uptime_ratio_7d,
      websiteUptime30d: monitor.uptime_ratio_30d,
      lastCheckedAt: attemptedAt,
      lastError: null,
      overallStatus,
    });
    results.push({
      tenantId,
      providerStatus,
      overallStatus,
      error: null,
    });
  }

  return results;
}

export async function getTenantOperationsHealth(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<{
  health: TenantOperationsHealth | null;
  uptimerobot: TenantOperationsHealthProvider | null;
}> {
  const [{ data: health }, { data: providers }] = await Promise.all([
    supabase
      .from(TABLES.tenantOperationsHealth)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from(TABLES.tenantOperationsHealthProviders)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", "uptimerobot")
      .maybeSingle(),
  ]);

  return {
    health: (health as TenantOperationsHealth | null) ?? null,
    uptimerobot:
      (providers as TenantOperationsHealthProvider | null) ?? null,
  };
}

export async function listUptimeRobotMonitorsForAdmin(
  fetchMonitors: UptimeRobotFetchFn,
): Promise<
  | { ok: true; monitors: Array<{ id: string; friendly_name: string; url: string }> }
  | { ok: false; error: string }
> {
  const result = await fetchMonitors();
  if (!result.ok) return result;
  return {
    ok: true,
    monitors: result.monitors.map((m) => ({
      id: m.id,
      friendly_name: m.friendly_name,
      url: m.url,
    })),
  };
}
