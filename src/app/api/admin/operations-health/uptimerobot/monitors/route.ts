import type { NextRequest } from "next/server";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { listUptimeRobotMonitorsForAdmin } from "@/lib/client-health/uptimerobot/refresh";
import { uptimeRobotClientFromEnv } from "@/lib/client-health/uptimerobot/client";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;

  const client = uptimeRobotClientFromEnv();
  const result = await listUptimeRobotMonitorsForAdmin(client.fetchMonitors);

  if (!result.ok) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: result.error },
      { status: result.error.includes("not configured") ? 503 : 502 },
    );
  }

  return jsonWithSessionCookies(auth.sessionCookies, {
    monitors: result.monitors,
  });
}
