import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicAuditApiAuthorized,
  publicAuditUnauthorizedResponse,
} from "@/lib/audit/public/auth";
import { withPublicAuditCors } from "@/lib/audit/public/cors";
import { getPublicAuditByToken } from "@/lib/audit/public/queries";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isPublicAuditApiAuthorized(request)) {
    return withPublicAuditCors(request, publicAuditUnauthorizedResponse());
  }

  const { token } = await context.params;
  const detail = await getPublicAuditByToken(token);
  if (!detail || !["succeeded", "partially_succeeded"].includes(detail.status)) {
    console.info("[audit/notification-claim] audit is not complete", {
      token: token.slice(0, 8),
      status: detail?.status ?? "not_found",
    });
    return withPublicAuditCors(
      request,
      NextResponse.json({ claimed: false, error: "Completed audit not found." }, { status: 404 }),
    );
  }

  // The conditional update is the idempotency gate. Only the first request
  // that sees a null marker receives claimed: true.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.auditRequests)
    .update({ owner_notification_sent_at: new Date().toISOString() })
    .eq("public_access_token", token)
    .eq("audit_type", "public")
    .is("owner_notification_sent_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[audit/notification-claim] claim failed", error.message);
    return withPublicAuditCors(
      request,
      NextResponse.json({ claimed: false, error: "Could not claim notification." }, { status: 500 }),
    );
  }

  return withPublicAuditCors(
    request,
    NextResponse.json({
      claimed: Boolean(data?.id),
      auditId: detail.runId,
      completedAt: detail.completedAt,
    }),
  );
}
