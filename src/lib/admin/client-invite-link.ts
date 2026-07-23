import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isResendConfigured,
  sendClientInviteEmail,
} from "@/lib/email/client-invite-email";
import {
  sendClientProposalEmail,
} from "@/lib/email/client-proposal-email";
import {
  ensureInviteActionLink,
  inviteRedirectUrl,
  loginWithNextUrl,
  offerRedirectUrl,
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

export type ExistingPortalClient = {
  tenantId: string | null;
  businessName: string;
  hasAuthAccount: boolean;
};

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function userHasSignedIn(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.user_metadata?.password_set === true ||
    Boolean(user.last_sign_in_at && !user.invited_at)
  );
}

export async function findAuthUserIdByEmail(
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

export async function findExistingPortalClientByEmail(
  supabase: ServiceClient,
  email: string,
): Promise<ExistingPortalClient | null> {
  const normalized = normalizeAuthEmail(email);

  const { data: profile } = await supabase
    .from(TABLES.tenantProfiles)
    .select("tenant_id, display_name, legal_business_name")
    .ilike("primary_contact_email", normalized)
    .limit(1)
    .maybeSingle();

  if (profile?.tenant_id) {
    return {
      tenantId: profile.tenant_id as string,
      businessName:
        (profile.legal_business_name as string | null) ??
        (profile.display_name as string | null) ??
        "Existing client",
      hasAuthAccount: true,
    };
  }

  const userId = await findAuthUserIdByEmail(supabase, normalized);
  if (!userId) return null;

  const { data: membership } = await supabase
    .from(TABLES.tenantMemberships)
    .select("tenant_id, tenants(display_name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const tenant = membership?.tenants as { display_name?: string } | null;

  return {
    tenantId: (membership?.tenant_id as string | null) ?? null,
    businessName: tenant?.display_name ?? "Existing client",
    hasAuthAccount: true,
  };
}

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
    hasSignedIn = userHasSignedIn(authUser.user);
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
      linkType: "invite" | "recovery" | "magiclink" | "login";
    }
  | {
      error: string;
      detail?: string;
    };

export function formatAuthInviteError(
  message: string,
  redirectTo: string,
): string {
  const lower = message.toLowerCase();

  if (lower.includes("already been registered") || lower.includes("already exists")) {
    return "That email already has a portal account. Open the existing client and use Send proposal on their Offers page.";
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

  const existingUserId = await findAuthUserIdByEmail(supabase, email);
  if (existingUserId) {
    const { data: authUser } =
      await supabase.auth.admin.getUserById(existingUserId);
    if (userHasSignedIn(authUser.user)) {
      return {
        error:
          "This email already has an active portal account. Use Send proposal on the client's Offers page instead of a new invite.",
      };
    }
  }

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

  if (existingUserId) {
    const recoveryAttempt = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: inviteRedirect,
      },
    });

    const recoveryResult = extractAccessLink(recoveryAttempt, inviteRedirect);
    if (recoveryResult) {
      return {
        inviteLink: recoveryResult.inviteLink,
        userId: recoveryResult.userId,
        linkType: "recovery",
      };
    }
  }

  const primaryError =
    inviteAttempt.error?.message ?? "Could not create a new invite link.";
  const redirectHint = formatAuthInviteError(primaryError, inviteRedirect);

  return {
    error: redirectHint,
    detail: primaryError,
  };
}

export async function createProposalPortalLink(
  supabase: ServiceClient,
  args: {
    email: string;
    fullName: string;
    tenantId: string;
  },
): Promise<ClientPortalAccessLinkResult> {
  const email = normalizeAuthEmail(args.email);
  const portalUrl = portalUrlForInvites();
  const proposalRedirect = offerRedirectUrl(portalUrl);
  const existingUserId = await findAuthUserIdByEmail(supabase, email);

  if (existingUserId) {
    const { data: authUser } =
      await supabase.auth.admin.getUserById(existingUserId);

    if (userHasSignedIn(authUser.user)) {
      const magicAttempt = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: proposalRedirect,
        },
      });

      const magicResult = extractAccessLink(magicAttempt, proposalRedirect);
      if (magicResult) {
        return {
          inviteLink: magicResult.inviteLink,
          userId: magicResult.userId,
          linkType: "magiclink",
        };
      }

      return {
        inviteLink: loginWithNextUrl(portalUrl, "/offer"),
        userId: existingUserId,
        linkType: "login",
      };
    }
  }

  return createClientPortalAccessLink(supabase, args);
}

export function authErrorDetail(error: { message?: string } | null | undefined): string {
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

export async function deliverClientProposalLink(args: {
  email: string;
  fullName: string;
  businessName: string;
  offerTitle: string;
  portalLink: string;
  linkType: "invite" | "recovery" | "magiclink" | "login";
}): Promise<{
  deliveryMethod: "email" | "link";
  emailError: string | null;
}> {
  if (!isResendConfigured()) {
    return { deliveryMethod: "link", emailError: null };
  }

  const sent = await sendClientProposalEmail({
    email: args.email,
    fullName: args.fullName,
    businessName: args.businessName,
    offerTitle: args.offerTitle,
    portalLink: args.portalLink,
    linkType: args.linkType,
  });

  if (sent.ok) {
    return { deliveryMethod: "email", emailError: null };
  }

  return {
    deliveryMethod: "link",
    emailError: sent.error ?? "Could not send proposal email.",
  };
}
