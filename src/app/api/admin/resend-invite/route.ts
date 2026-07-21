import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createClientPortalAccessLink,
  deliverClientInviteLink,
  getTenantOwnerInviteTarget,
} from "@/lib/admin/client-invite-link";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import {
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required to resend invites." },
      { status: 503 },
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to your environment to resend invites.",
      },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const owner = await getTenantOwnerInviteTarget(supabase, parsed.data.tenantId);

  if (!owner) {
    return NextResponse.json(
      { error: "Could not find the client owner for this tenant." },
      { status: 404 },
    );
  }

  if (owner.hasSignedIn) {
    return NextResponse.json(
      {
        error:
          "This client has already signed in. Use Supabase password recovery if they need a new password.",
        alreadyActive: true,
      },
      { status: 400 },
    );
  }

  const linkResult = await createClientPortalAccessLink(supabase, {
    email: owner.email,
    fullName: owner.fullName,
    tenantId: parsed.data.tenantId,
  });

  if ("error" in linkResult) {
    return NextResponse.json({ error: linkResult.error }, { status: 400 });
  }

  const delivery = await deliverClientInviteLink({
    email: owner.email,
    fullName: owner.fullName,
    businessName: owner.businessName,
    inviteLink: linkResult.inviteLink,
  });

  return NextResponse.json({
    email: owner.email,
    inviteMethod: delivery.inviteMethod,
    inviteLink:
      delivery.inviteMethod === "link" ? linkResult.inviteLink : null,
    message:
      delivery.inviteMethod === "email"
        ? `Invite email resent to ${owner.email}. They should open it in a private browser window (or sign out of the admin portal first).`
        : delivery.inviteEmailError
          ? `${delivery.inviteEmailError} Copy the new invite link below and send it to ${owner.email}.`
          : `New invite link created for ${owner.email}. Copy it below and send it privately.`,
  });
}
