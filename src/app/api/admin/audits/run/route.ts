import { type NextRequest } from "next/server";

import {
  AUDIT_RUN_PERMISSIONS,
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { adminRunAuditSchema, toAuditType } from "@/lib/audit/admin/validation";
import { executeAuditSynchronously } from "@/lib/audit/execute-audit";
import { UrlValidationError } from "@/lib/audit/url/normalize";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiAuth(request, [...AUDIT_RUN_PERMISSIONS]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = adminRunAuditSchema.safeParse(body);
  if (!parsed.success) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    const result = await executeAuditSynchronously({
      rawUrl: input.rawUrl,
      auditType: toAuditType(input.scopeChoice),
      tenantId: input.tenantId ?? null,
      businessName: input.businessName ?? null,
      internalNotes: input.internalNotes ?? null,
      requestedByUserId: auth.userId,
      source: "admin",
    });

    return jsonWithSessionCookies(auth.sessionCookies, {
      runId: result.runId,
      requestId: result.requestId,
      status: result.status,
      overallScore: result.overallScore,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return jsonWithSessionCookies(
        auth.sessionCookies,
        { error: error.message },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Audit failed.";
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: message },
      { status: 500 },
    );
  }
}
