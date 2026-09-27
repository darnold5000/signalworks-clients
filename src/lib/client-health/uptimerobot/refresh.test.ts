import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshUptimeRobotHealthForTenant } from "@/lib/client-health/uptimerobot/refresh";
import type { UptimeRobotFetchFn } from "@/lib/client-health/uptimerobot/types";

function createMockSupabase(handlers: {
  monitorId: string | null;
  upserts: Record<string, unknown>[];
  providerStatuses?: string[];
}) {
  const upserts = handlers.upserts;
  return {
    from: (table: string) => {
      if (table === "tenant_technical_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: handlers.monitorId
                  ? { uptime_robot_monitor_id: handlers.monitorId }
                  : { uptime_robot_monitor_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "tenant_operations_health_providers") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            upserts.push({ table, ...row });
            return { error: null };
          },
          select: () => ({
            eq: async () => ({
              data: [
                {
                  status:
                    (upserts.find(
                      (u) =>
                        u.table === table && u.provider === "uptimerobot",
                    )?.status as string) ?? "not_configured",
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "tenant_operations_health") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            upserts.push({ table, ...row });
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe("refreshUptimeRobotHealthForTenant", () => {
  it("writes not_configured when monitor id is missing", async () => {
    const upserts: Record<string, unknown>[] = [];
    const fetchMonitors = vi.fn() as UptimeRobotFetchFn;
    const result = await refreshUptimeRobotHealthForTenant(
      "tenant-1",
      createMockSupabase({ monitorId: null, upserts }),
      fetchMonitors,
    );
    expect(result.providerStatus).toBe("not_configured");
    expect(fetchMonitors).not.toHaveBeenCalled();
    expect(upserts.some((u) => u.status === "not_configured")).toBe(true);
  });

  it("writes unknown when API fails", async () => {
    const upserts: Record<string, unknown>[] = [];
    const fetchMonitors: UptimeRobotFetchFn = async () => ({
      ok: false,
      error: "Invalid api_key",
    });
    const result = await refreshUptimeRobotHealthForTenant(
      "tenant-1",
      createMockSupabase({ monitorId: "123", upserts }),
      fetchMonitors,
    );
    expect(result.providerStatus).toBe("unknown");
    expect(result.error).toContain("Invalid api_key");
    const healthUpsert = upserts.find(
      (u) => u.table === "tenant_operations_health",
    );
    expect(healthUpsert?.website_status).toBe("unknown");
    expect(healthUpsert?.last_error).toContain("Invalid api_key");
  });

  it("writes healthy when monitor is up", async () => {
    const upserts: Record<string, unknown>[] = [];
    const fetchMonitors: UptimeRobotFetchFn = async () => ({
      ok: true,
      monitors: [
        {
          id: "123",
          friendly_name: "Test",
          url: "https://example.com",
          status: 2,
          average_response_time: 200,
          uptime_ratio_30d: 99.9,
          uptime_ratio_7d: 99.8,
          uptime_ratio_24h: 100,
          uptime_ratio_all_time: 99,
          last_check_time: 1_700_000_000,
        },
      ],
    });
    const result = await refreshUptimeRobotHealthForTenant(
      "tenant-1",
      createMockSupabase({ monitorId: "123", upserts }),
      fetchMonitors,
    );
    expect(result.providerStatus).toBe("healthy");
    const healthUpsert = upserts.find(
      (u) => u.table === "tenant_operations_health",
    );
    expect(healthUpsert?.website_status).toBe("healthy");
    expect(healthUpsert?.website_response_ms).toBe(200);
    expect(healthUpsert?.website_uptime_30d).toBe(99.9);
  });

  it("writes critical when monitor is down", async () => {
    const upserts: Record<string, unknown>[] = [];
    const fetchMonitors: UptimeRobotFetchFn = async () => ({
      ok: true,
      monitors: [
        {
          id: "123",
          friendly_name: "Test",
          url: "https://example.com",
          status: 9,
          average_response_time: null,
          uptime_ratio_30d: null,
          uptime_ratio_7d: null,
          uptime_ratio_24h: null,
          uptime_ratio_all_time: null,
          last_check_time: null,
        },
      ],
    });
    const result = await refreshUptimeRobotHealthForTenant(
      "tenant-1",
      createMockSupabase({ monitorId: "123", upserts }),
      fetchMonitors,
    );
    expect(result.providerStatus).toBe("critical");
  });
});
