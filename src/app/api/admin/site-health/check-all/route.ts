import type { NextRequest } from "next/server";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { listSiteHealthSites, runSiteHealthCheck } from "@/lib/site-health/service";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const sites = await listSiteHealthSites(auth.supabase);
    const completed: Array<{ tenantId: string; ok: boolean }> = [];
    for (let index = 0; index < sites.length; index += 3) {
      const batch = sites.slice(index, index + 3);
      const outcomes = await Promise.all(
        batch.map(async (site) => {
          try {
            await runSiteHealthCheck(site.tenantId, auth.supabase);
            return { tenantId: site.tenantId, ok: true };
          } catch {
            return { tenantId: site.tenantId, ok: false };
          }
        }),
      );
      completed.push(...outcomes);
    }
    return jsonWithSessionCookies(auth.sessionCookies, { completed });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: error instanceof Error ? error.message : "Site checks failed." },
      { status: 500 },
    );
  }
}
