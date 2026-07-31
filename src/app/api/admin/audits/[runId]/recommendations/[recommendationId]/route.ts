import { type NextRequest } from "next/server";

import {
  AUDIT_VIEW_PERMISSIONS,
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { updateRecommendationStatus } from "@/lib/audit/admin/queries";
import { recommendationStatusSchema } from "@/lib/audit/admin/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ runId: string; recommendationId: string }> },
) {
  const auth = await requireAdminApiAuth(request, [...AUDIT_VIEW_PERMISSIONS]);
  if (!auth.ok) return auth.response;

  const { runId, recommendationId } = await context.params;
  const body = (await request.json()) as { status?: string };
  const status = recommendationStatusSchema.safeParse(body.status);
  if (!status.success) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: "Invalid recommendation status." },
      { status: 400 },
    );
  }

  try {
    await updateRecommendationStatus(runId, recommendationId, status.data);
    return jsonWithSessionCookies(auth.sessionCookies, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update recommendation.";
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: message },
      { status: 500 },
    );
  }
}
