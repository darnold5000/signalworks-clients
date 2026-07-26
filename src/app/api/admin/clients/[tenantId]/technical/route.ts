import { NextResponse } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { upsertTenantTechnicalProfile } from "@/lib/technical/technical-profile-service";
import { technicalProfileUpdateSchema } from "@/lib/technical/technical-profile-schema";

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

  const parsed = technicalProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const technical = await upsertTenantTechnicalProfile(tenantId, parsed.data);
    await logTenantActivity({
      tenantId,
      actorUserId: profile.id,
      actorType: "admin",
      action: "technical_profile.updated",
      entityType: "technical_profile",
      entityId: tenantId,
      summary: "Updated client technical profile and infrastructure inventory",
    });
    return NextResponse.json({ technical });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
