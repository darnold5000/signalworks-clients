import { NextResponse, type NextRequest } from "next/server";

import {
  AUDIT_VIEW_PERMISSIONS,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { getAdminAuditRunDetail } from "@/lib/audit/admin/queries";
import { buildAuditReportHtml } from "@/lib/audit/reports/html-report";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const auth = await requireAdminApiAuth(request, [...AUDIT_VIEW_PERMISSIONS]);
  if (!auth.ok) return auth.response;

  const { runId } = await context.params;
  const detail = await getAdminAuditRunDetail(runId);
  if (!detail) {
    return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  }

  const html = buildAuditReportHtml(detail);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
