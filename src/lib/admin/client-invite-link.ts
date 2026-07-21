import {
  isResendConfigured,
  sendClientInviteEmail,
} from "@/lib/email/client-invite-email";
import {
  ensureInviteActionLink,
  inviteRedirectUrl,
  portalUrlForInvites,
  recoveryRedirectUrl,
} from "@/lib/site";
import { ROLE_SLUGS } from "@/lib/permissions";
import type { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type TenantOwnerInviteTarget = {
  userId: string;
  email: string;
  fullName: string;
  businessName: string;
  hasSignedIn: boolean;
};

export async function getTenantOwnerInviteTarget(
  supabase: ServiceClient,
  tenantId: string,
): Promise<TenantOwnerInviteTarget | null> {
  const { data: tenant } = await supabase
    .from(TABLES.tenants)
    .select("id, display_name")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return null;

  const { data: ownerRole } = await supabase
    .from(TABLES.roles)
    .select("id")
    .is("tenant_id", null)
    .eq("slug", ROLE_SLUGS.tenantOwner)
    .single();

  if (!ownerRole) return null;

  const { data: membership } = await supabase
    .from(TABLES.tenantMemberships)
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role_id", ownerRole.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership?.user_id) return null;

  const { data: profile } = await supabase
    .from(TABLES.profiles)
    .select("id, email, full_name")
    .eq("id", membership.user_id)
    .maybeSingle();

  if (!profile?.email) return null;

  const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);

  return {
    userId: profile.id,
    email: profile.email.trim().toLowerCase(),
    fullName: profile.full_name?.trim() || tenant.display_name,
    businessName: tenant.display_name,
    hasSignedIn: Boolean(authUser.user?.last_sign_in_at),
  };
}

export async function createClientPortalAccessLink(
  supabase: ServiceClient,
  args: {
    email: string;
    fullName: string;
    tenantId: string;
  },
): Promise<{ inviteLink: string } | { error: string }> {
  const portalUrl = portalUrlForInvites();
  const inviteRedirect = inviteRedirectUrl(portalUrl);
  const recoveryRedirect = recoveryRedirectUrl(portalUrl);

  const inviteAttempt = await supabase.auth.admin.generateLink({
    type: "invite",
    email: args.email,
    options: {
      data: {
        full_name: args.fullName,
        tenant_id: args.tenantId,
      },
      redirectTo: inviteRedirect,
    },
  });

  if (!inviteAttempt.error && inviteAttempt.data.properties?.action_link) {
    const inviteLink = ensureInviteActionLink(
      inviteAttempt.data.properties.action_link,
      inviteRedirect,
    );
    if (inviteLink) return { inviteLink };
  }

  const recoveryAttempt = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: args.email,
    options: {
      redirectTo: recoveryRedirect,
    },
  });

  if (!recoveryAttempt.error && recoveryAttempt.data.properties?.action_link) {
    const inviteLink = ensureInviteActionLink(
      recoveryAttempt.data.properties.action_link,
      recoveryRedirect,
    );
    if (inviteLink) return { inviteLink };
  }

  return { error: "Could not create a new invite link." };
}

export async function deliverClientInviteLink(args: {
  email: string;
  fullName: string;
  businessName: string;
  inviteLink: string;
}): Promise<{
  inviteMethod: "email" | "link";
  inviteEmailError: string | null;
}> {
  if (!isResendConfigured()) {
    return { inviteMethod: "link", inviteEmailError: null };
  }

  const sent = await sendClientInviteEmail({
    email: args.email,
    fullName: args.fullName,
    businessName: args.businessName,
    inviteLink: args.inviteLink,
  });

  if (sent.ok) {
    return { inviteMethod: "email", inviteEmailError: null };
  }

  return {
    inviteMethod: "link",
    inviteEmailError: sent.error ?? "Could not send invite email.",
  };
}
