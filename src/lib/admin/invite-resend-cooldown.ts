import { TABLES } from "@/lib/supabase/tables";
import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

const RESEND_COOLDOWN_MS = 60_000;

const RESEND_ACTIONS = ["invite.email_sent", "invite.resent"] as const;

export async function getResendInviteCooldownMessage(
  supabase: ServiceClient,
  tenantId: string,
): Promise<string | null> {
  const since = new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString();
  const { data } = await supabase
    .from(TABLES.tenantActivityLog)
    .select("id")
    .eq("tenant_id", tenantId)
    .in("action", [...RESEND_ACTIONS])
    .gte("created_at", since)
    .limit(1);

  if (data?.length) {
    return "Please wait about a minute before resending another invite.";
  }

  return null;
}
