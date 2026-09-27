import type { NextRequest } from "next/server";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import {
  getTenantOperationsHealth,
  refreshUptimeRobotHealthForTenant,
} from "@/lib/client-health/uptimerobot/refresh";
import { uptimeRobotClientFromEnv } from "@/lib/client-health/uptimerobot/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;

  const { tenantId } = await params;
  const client = uptimeRobotClientFromEnv();

  try {
    const result = await refreshUptimeRobotHealthForTenant(
      tenantId,
      auth.supabase,
      client.fetchMonitors,
    );
    const snapshot = await getTenantOperationsHealth(
      tenantId,
      auth.supabase,
    );
    return jsonWithSessionCookies(auth.sessionCookies, {
      result,
      ...snapshot,
    });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      {
        error:
          error instanceof Error
            ? error.message
            : "UptimeRobot refresh failed.",
      },
      { status: 500 },
    );
  }
}
