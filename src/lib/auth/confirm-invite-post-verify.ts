import type { User } from "@supabase/supabase-js";
import type { InviteErrorReason } from "@/lib/auth/branded-invite-flow";
import type { PortalInviteAccessResult } from "@/lib/auth/portal-invite-access";

export type AfterInviteOtpVerifiedResult =
  | { kind: "success"; tenantId: string | null }
  | { kind: "failure"; reason: InviteErrorReason };

/**
 * Runs after verifyOtp succeeds. Clears the session when the user cannot use
 * the client portal (so a one-time invite token does not leave them signed in).
 */
export async function afterInviteOtpVerified(args: {
  getUser: () => Promise<{
    data: { user: User | null };
    error: Error | null;
  }>;
  signOut: () => Promise<{ error: Error | null }>;
  resolvePortalAccess: (userId: string) => Promise<PortalInviteAccessResult>;
  onLinkVerified?: (tenantId: string, userId: string) => Promise<void>;
}): Promise<AfterInviteOtpVerifiedResult> {
  const {
    data: { user },
    error: userError,
  } = await args.getUser();

  if (userError || !user) {
    await args.signOut();
    return { kind: "failure", reason: "invalid-link" };
  }

  const access = await args.resolvePortalAccess(user.id);
  if (!access.ok) {
    await args.signOut();
    return { kind: "failure", reason: "not-authorized" };
  }

  if (args.onLinkVerified && access.tenantId) {
    try {
      await args.onLinkVerified(access.tenantId, user.id);
    } catch (error) {
      console.error(
        "[auth/confirm-invite] invite.link_verified log failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return { kind: "success", tenantId: access.tenantId ?? null };
}
