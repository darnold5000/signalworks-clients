import { NextResponse } from "next/server";
import { tenantProfileUpdateSchema } from "@/lib/admin/tenant-profile-schema";
import { upsertTenantProfile } from "@/lib/admin/tenant-profile-service";
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

  const parsed = tenantProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tenantProfile = await upsertTenantProfile(
      tenantId,
      parsed.data,
      profile.id,
    );
    return NextResponse.json({ profile: tenantProfile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
