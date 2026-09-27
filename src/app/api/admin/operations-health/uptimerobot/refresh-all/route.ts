import type { NextRequest } from "next/server";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { refreshUptimeRobotHealthForAllConfiguredTenants } from "@/lib/client-health/uptimerobot/refresh";
import { uptimeRobotClientFromEnv } from "@/lib/client-health/uptimerobot/client";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;

  const client = uptimeRobotClientFromEnv();

  try {
    const results = await refreshUptimeRobotHealthForAllConfiguredTenants(
      auth.supabase,
      client.fetchMonitors,
    );
    return jsonWithSessionCookies(auth.sessionCookies, {
      refreshed: results.length,
      results,
    });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      {
        error:
          error instanceof Error
            ? error.message
            : "Bulk UptimeRobot refresh failed.",
      },
      { status: 500 },
    );
  }
}
