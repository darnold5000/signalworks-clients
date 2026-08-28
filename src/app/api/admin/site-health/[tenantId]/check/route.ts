import type { NextRequest } from "next/server";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { runSiteHealthCheck } from "@/lib/site-health/service";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;
  const { tenantId } = await params;
  try {
    const result = await runSiteHealthCheck(tenantId, auth.supabase);
    return jsonWithSessionCookies(auth.sessionCookies, { result });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: error instanceof Error ? error.message : "Site check failed." },
      { status: 500 },
    );
  }
}
