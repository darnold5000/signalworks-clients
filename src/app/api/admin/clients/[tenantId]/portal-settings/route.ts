import { NextResponse } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { portalWebsiteSettingsUpdateSchema } from "@/lib/admin/portal-settings-schema";
import { updateTenantPortalWebsiteSettings } from "@/lib/admin/portal-settings-service";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = portalWebsiteSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const settings = await updateTenantPortalWebsiteSettings(
      tenantId,
      parsed.data,
    );
    await logTenantActivity({
      tenantId,
      actorUserId: profile.id,
      actorType: "admin",
      action: "portal_settings.website_updated",
      entityType: "tenant_portal_settings",
      entityId: tenantId,
      summary: "Updated client portal website information",
    });
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
