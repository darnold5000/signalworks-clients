import type { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type PortalInviteAccess = {
  ok: true;
  tenantId: string;
};

export type PortalInviteAccessResult = PortalInviteAccess | { ok: false };

/**
 * Confirms the authenticated user belongs to a Signal Works services client tenant.
 */
export async function getPortalInviteAccessForUser(
  supabase: ServiceClient,
  userId: string,
): Promise<PortalInviteAccessResult> {
  const { data: memberships, error } = await supabase
    .from(TABLES.tenantMemberships)
    .select("tenant_id, status, tenants(platform_category)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !memberships?.length) {
    return { ok: false };
  }

  for (const row of memberships) {
    const tenant = row.tenants as { platform_category?: string } | null;
    if (tenant?.platform_category === "services" && row.tenant_id) {
      return { ok: true, tenantId: row.tenant_id as string };
    }
  }

  return { ok: false };
}
