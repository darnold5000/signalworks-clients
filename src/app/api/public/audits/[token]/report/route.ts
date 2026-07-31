import { NextResponse, type NextRequest } from "next/server";

import {
  isPublicAuditApiAuthorized,
  publicAuditUnauthorizedResponse,
} from "@/lib/audit/public/auth";
import { withPublicAuditCors } from "@/lib/audit/public/cors";
import { getPublicAuditByToken } from "@/lib/audit/public/queries";
import { buildPublicAuditReportHtml } from "@/lib/audit/public/report";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isPublicAuditApiAuthorized(request)) {
    return withPublicAuditCors(request, publicAuditUnauthorizedResponse());
  }

  const { token } = await context.params;
  const detail = await getPublicAuditByToken(token);
  if (!detail) {
    return withPublicAuditCors(
      request,
      NextResponse.json({ error: "Audit not found." }, { status: 404 }),
    );
  }

  const html = buildPublicAuditReportHtml(detail);
  return withPublicAuditCors(
    request,
    new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }),
  );
}
