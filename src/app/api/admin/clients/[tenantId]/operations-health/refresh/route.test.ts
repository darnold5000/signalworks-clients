import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminApiAuth, refreshUptimeRobotHealthForTenant, getTenantOperationsHealth } =
  vi.hoisted(() => ({
    requireAdminApiAuth: vi.fn(),
    refreshUptimeRobotHealthForTenant: vi.fn(),
    getTenantOperationsHealth: vi.fn(),
  }));

vi.mock("@/lib/admin/require-admin-api-auth", () => ({
  requireAdminApiAuth,
  jsonWithSessionCookies: (
    _cookies: unknown,
    body: Record<string, unknown>,
    init?: ResponseInit,
  ) => Response.json(body, init),
}));

vi.mock("@/lib/client-health/uptimerobot/refresh", () => ({
  refreshUptimeRobotHealthForTenant,
  getTenantOperationsHealth,
}));

vi.mock("@/lib/client-health/uptimerobot/client", () => ({
  uptimeRobotClientFromEnv: () => ({
    fetchMonitors: vi.fn(),
  }),
}));

import { POST } from "./route";

describe("POST operations-health refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when admin auth fails", async () => {
    requireAdminApiAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ tenantId: "tenant-1" }),
    });

    expect(response.status).toBe(401);
    expect(refreshUptimeRobotHealthForTenant).not.toHaveBeenCalled();
  });

  it("refreshes when admin auth succeeds", async () => {
    requireAdminApiAuth.mockResolvedValue({
      ok: true,
      supabase: {},
      sessionCookies: { cookies: { getAll: () => [] } },
      userId: "user-1",
    });
    refreshUptimeRobotHealthForTenant.mockResolvedValue({
      tenantId: "tenant-1",
      providerStatus: "healthy",
      overallStatus: "healthy",
      error: null,
    });
    getTenantOperationsHealth.mockResolvedValue({
      health: { website_status: "healthy" },
      uptimerobot: { status: "healthy" },
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ tenantId: "tenant-1" }),
    });

    expect(response.status).toBe(200);
    expect(refreshUptimeRobotHealthForTenant).toHaveBeenCalledOnce();
  });
});
