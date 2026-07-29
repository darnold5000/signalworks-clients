import type { TenantActivityLogEntry, TenantProfile } from "@/lib/database/phase1-types";
import type { TenantOwnerInviteTarget } from "@/lib/admin/client-invite-link";
import { formatDateTime } from "@/lib/utils";

export type PortalInviteDisplay = {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
  detail?: string;
};

const INVITE_EMAIL_ACTIONS = new Set([
  "invite.email_sent",
  "invite.resent",
]);

function lastInviteEmailSentAt(
  activity: TenantActivityLogEntry[],
): string | null {
  for (const row of activity) {
    if (INVITE_EMAIL_ACTIONS.has(row.action)) {
      return row.created_at;
    }
    if (row.action === "invite_client.completed") {
      const metadata = row.metadata as { invite_method?: string } | null;
      if (metadata?.invite_method === "email") {
        return row.created_at;
      }
    }
  }
  return null;
}

export function getPortalInviteDisplay(args: {
  profile: TenantProfile | null;
  owner: TenantOwnerInviteTarget | null;
  activity: TenantActivityLogEntry[];
}): PortalInviteDisplay | null {
  if (args.owner?.hasSignedIn) {
    return {
      label: "Portal active",
      tone: "success",
      detail: "Client owner has signed in to the portal.",
    };
  }

  const emailedAt = lastInviteEmailSentAt(args.activity);
  if (emailedAt) {
    return {
      label: "Invite sent",
      tone: "warning",
      detail: `Last invite email ${formatDateTime(emailedAt)}`,
    };
  }

  if (args.profile?.internal_status === "invited") {
    return {
      label: "Invited",
      tone: "warning",
      detail: "Invite created; email may need to be sent or copied manually.",
    };
  }

  if (
    args.profile?.onboarding_status === "invited" ||
    args.profile?.onboarding_status === "account_created"
  ) {
    return {
      label: "Awaiting portal setup",
      tone: "neutral",
      detail: "Client has not finished portal onboarding.",
    };
  }

  return null;
}
