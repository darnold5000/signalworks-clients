import type { PortalWebsiteSettingsUpdate } from "@/lib/admin/portal-settings-schema";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function updateTenantPortalWebsiteSettings(
  tenantId: string,
  input: PortalWebsiteSettingsUpdate,
) {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.domain !== undefined) patch.domain = input.domain;
  if (input.hosting_status !== undefined) {
    patch.hosting_status = input.hosting_status;
  }
  if (input.website_last_updated_at !== undefined) {
    patch.website_last_updated_at = input.website_last_updated_at;
  }
  if (input.website_security_status !== undefined) {
    patch.website_security_status = input.website_security_status;
    patch.ssl_status =
      input.website_security_status === "protected"
        ? "active"
        : input.website_security_status === "issue_detected"
          ? "error"
          : "pending";
  }
  if (input.website_security_https_enabled !== undefined) {
    patch.website_security_https_enabled = input.website_security_https_enabled;
  }
  if (input.website_security_cert_valid !== undefined) {
    patch.website_security_cert_valid = input.website_security_cert_valid;
  }
  if (input.website_security_cert_expires_at !== undefined) {
    patch.website_security_cert_expires_at =
      input.website_security_cert_expires_at;
  }

  const { data, error } = await supabase
    .from(TABLES.tenantPortalSettings)
    .update(patch)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Portal settings not found for tenant.");
  return data;
}
