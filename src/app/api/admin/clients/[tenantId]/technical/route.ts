import { NextResponse, type NextRequest } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
  TECHNICAL_PROFILE_ADMIN_PERMISSIONS,
} from "@/lib/admin/require-admin-api-auth";
import { upsertTenantTechnicalProfile } from "@/lib/technical/technical-profile-service";
import { technicalProfileUpdateSchema } from "@/lib/technical/technical-profile-schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireAdminApiAuth(request, [
    ...TECHNICAL_PROFILE_ADMIN_PERMISSIONS,
  ]);
  if (!auth.ok) {
    return auth.response;
  }

  const { tenantId } = await params;
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

  const parsed = technicalProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const technical = await upsertTenantTechnicalProfile(
      tenantId,
      parsed.data,
      auth.supabase,
    );
    await logTenantActivity({
      tenantId,
      actorUserId: auth.userId,
      actorType: "admin",
      action: "technical_profile.updated",
      entityType: "technical_profile",
      entityId: tenantId,
      summary: "Updated client technical profile and infrastructure inventory",
    });
    return jsonWithSessionCookies(auth.sessionCookies, { technical });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: message },
      { status: 400 },
    );
  }
}
