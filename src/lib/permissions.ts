import { authDebug } from "@/lib/auth-debug";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const PERMISSIONS = {
  manageTenants: "manage_tenants",
  viewAllTenants: "view_all_tenants",
  manageMemberships: "manage_memberships",
  manageBilling: "manage_billing",
  manageClientBilling: "manage_client_billing",
  manageWebsite: "manage_website",
  viewTenantPortal: "view_tenant_portal",
  manageClientTechnicalDetails: "manage_client_technical_details",
  manageClientOffers: "manage_client_offers",
  manageClientAgreements: "manage_client_agreements",
} as const;

export const ROLE_SLUGS = {
  platformAdmin: "platform_admin",
  tenantOwner: "tenant_owner",
  tenantMember: "tenant_member",
} as const;

export async function userHasPlatformPermission(
  permissionName: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("has_platform_permission", {
    permission_name: permissionName,
  });

  authDebug("has_platform_permission", {
    permissionName,
    dashboardServerUserId: user?.id ?? null,
    result: Boolean(data),
    error: error?.message ?? null,
  });

  if (error) {
    console.error("has_platform_permission failed", error.message);
    return false;
  }

  return Boolean(data);
}
