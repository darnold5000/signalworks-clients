import { NextResponse } from "next/server";
import { z } from "zod";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { getPortalInviteAccessForUser } from "@/lib/auth/portal-invite-access";
import {
  createClient,
  createServiceClient,
  isSupabaseConfigured,
  isServiceRoleConfigured,
} from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const bodySchema = z.object({
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          "Invitation session expired. Ask Signal Works to resend your invite.",
      },
      { status: 401 },
    );
  }

  let portalTenantId: string | null = null;
  if (isServiceRoleConfigured()) {
    const admin = createServiceClient();
    const access = await getPortalInviteAccessForUser(admin, user.id);
    if (!access.ok) {
      return NextResponse.json(
        { error: "This account is not authorized for the client portal." },
        { status: 403 },
      );
    }
    portalTenantId = access.tenantId;
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: {
      full_name: parsed.data.fullName,
      password_set: true,
    },
  });

  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  const { error: profileError } = await supabase.from(TABLES.profiles).upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: parsed.data.fullName,
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[api/auth/accept-invite] profile", profileError.message);
  }

  if (portalTenantId && isServiceRoleConfigured()) {
    const admin = createServiceClient();
    await admin
      .from(TABLES.tenantProfiles)
      .update({ onboarding_status: "account_created" })
      .eq("tenant_id", portalTenantId);

    await logTenantActivity({
      tenantId: portalTenantId,
      actorUserId: user.id,
      actorType: "user",
      action: "invite.password_created",
      entityType: "user",
      entityId: user.id,
      summary: "Client created portal password",
    });
  }

  return NextResponse.json({ ok: true, redirectTo: "/overview" });
}
