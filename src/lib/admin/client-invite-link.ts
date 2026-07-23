import type { AuthError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
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
type DbClient = SupabaseClient | ServiceClient;

export type TenantOwnerInviteTarget = {
  userId: string;
  email: string;
  fullName: string;
  businessName: string;
  hasSignedIn: boolean;
};

export async function getTenantOwnerInviteTarget(
  supabase: DbClient,
  tenantId: string,
  options?: { checkSignIn?: ServiceClient },
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

  let hasSignedIn = false;
  if (options?.checkSignIn) {
    const { data: authUser } = await options.checkSignIn.auth.admin.getUserById(
      profile.id,
    );
    hasSignedIn =
      authUser.user?.user_metadata?.password_set === true ||
      Boolean(
        authUser.user?.last_sign_in_at &&
          !authUser.user?.invited_at,
      );
  }

  return {
    userId: profile.id,
    email: profile.email.trim().toLowerCase(),
    fullName: profile.full_name?.trim() || tenant.display_name,
    businessName: tenant.display_name,
    hasSignedIn,
  };
}


type GenerateLinkResponse = Awaited<
  ReturnType<ServiceClient["auth"]["admin"]["generateLink"]>
>;

export type ClientPortalAccessLinkResult =
  | {
      inviteLink: string;
      userId: string;
      linkType: "invite" | "recovery";
    }
  | {
      error: string;
      detail?: string;
    };

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function formatAuthInviteError(
  message: string,
  redirectTo: string,
): string {
  const lower = message.toLowerCase();

  if (lower.includes("already been registered") || lower.includes("already exists")) {
    return "That email already has a Supabase Auth account. Use Resend invite on the client overview, or remove the user in Supabase Auth and try again.";
  }

  if (lower.includes("redirect") || lower.includes("invalid url")) {
    return `Supabase rejected the invite redirect URL. Add this to Authentication → URL configuration → Redirect URLs: ${redirectTo}`;
  }

  if (lower.includes("signup") && lower.includes("disabled")) {
    return "Email signups are disabled in Supabase Auth. Enable the Email provider under Authentication → Providers.";
  }

  if (lower.includes("rate limit")) {
    return "Supabase Auth rate limit reached. Wait a minute and try again.";
  }

  return "Could not create invite link. Check Supabase Auth settings.";
}

function extractAccessLink(
  attempt: GenerateLinkResponse,
  redirectTo: string,
): { inviteLink: string; userId: string } | null {
  if (attempt.error || !attempt.data?.properties?.action_link) {
    return null;
  }

  const inviteLink = ensureInviteActionLink(
    attempt.data.properties.action_link,
    redirectTo,
  );
  if (!inviteLink) return null;

  const userId = attempt.data.user?.id;
  if (!userId) return null;

  return { inviteLink, userId };
}

async function findAuthUserIdByEmail(
  supabase: ServiceClient,
  email: string,
): Promise<string | null> {
  const normalized = normalizeAuthEmail(email);
  let page = 1;

  while (page <= 5) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error || !data.users.length) {
      return null;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (match?.id) return match.id;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

export async function createClientPortalAccessLink(
  supabase: ServiceClient,
  args: {
    email: string;
    fullName: string;
    tenantId: string;
  },
): Promise<ClientPortalAccessLinkResult> {
  const email = normalizeAuthEmail(args.email);
  const portalUrl = portalUrlForInvites();
  const inviteRedirect = inviteRedirectUrl(portalUrl);
  const recoveryRedirect = recoveryRedirectUrl(portalUrl);

  const inviteAttempt = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        full_name: args.fullName,
        tenant_id: args.tenantId,
      },
      redirectTo: inviteRedirect,
    },
  });

  const inviteResult = extractAccessLink(inviteAttempt, inviteRedirect);
  if (inviteResult) {
    return {
      inviteLink: inviteResult.inviteLink,
      userId: inviteResult.userId,
      linkType: "invite",
    };
  }

  const recoveryAttempt = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: recoveryRedirect,
    },
  });

  const recoveryResult = extractAccessLink(recoveryAttempt, recoveryRedirect);
  if (recoveryResult) {
    return {
      inviteLink: recoveryResult.inviteLink,
      userId: recoveryResult.userId,
      linkType: "recovery",
    };
  }

  const inviteLinkOnly = inviteAttempt.data?.properties?.action_link
    ? ensureInviteActionLink(inviteAttempt.data.properties.action_link, inviteRedirect)
    : recoveryAttempt.data?.properties?.action_link
      ? ensureInviteActionLink(
          recoveryAttempt.data.properties.action_link,
          recoveryRedirect,
        )
      : null;

  if (inviteLinkOnly) {
    const userId =
      inviteAttempt.data?.user?.id ??
      recoveryAttempt.data?.user?.id ??
      (await findAuthUserIdByEmail(supabase, email));

    if (userId) {
      return {
        inviteLink: inviteLinkOnly,
        userId,
        linkType: recoveryAttempt.data?.properties?.action_link
          ? "recovery"
          : "invite",
      };
    }
  }

  const primaryError =
    inviteAttempt.error?.message ??
    recoveryAttempt.error?.message ??
    "Could not create a new invite link.";
  const redirectHint = formatAuthInviteError(primaryError, inviteRedirect);

  return {
    error: redirectHint,
    detail: primaryError,
  };
}

export function authErrorDetail(error: AuthError | null | undefined): string {
  return error?.message?.trim() ?? "";
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
