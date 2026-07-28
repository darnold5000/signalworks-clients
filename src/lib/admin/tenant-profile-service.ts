import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import type { TenantProfileUpdateInput } from "@/lib/admin/tenant-profile-schema";
import type { TenantProfile } from "@/lib/database/phase1-types";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

export async function upsertTenantProfile(
  tenantId: string,
  input: TenantProfileUpdateInput,
  actorUserId: string | null,
): Promise<TenantProfile> {
  const supabase = createServiceClient();

  const row = {
    tenant_id: tenantId,
    legal_business_name: emptyToNull(input.legal_business_name ?? null),
    display_name: emptyToNull(input.display_name ?? null),
    business_type: emptyToNull(input.business_type ?? null),
    primary_contact_name: emptyToNull(input.primary_contact_name ?? null),
    primary_contact_email: emptyToNull(input.primary_contact_email ?? null),
    primary_contact_phone: emptyToNull(input.primary_contact_phone ?? null),
    billing_contact_name: emptyToNull(input.billing_contact_name ?? null),
    billing_contact_email: emptyToNull(input.billing_contact_email ?? null),
    website_url: emptyToNull(input.website_url ?? null),
    primary_domain: emptyToNull(input.primary_domain ?? null),
    support_email: emptyToNull(input.support_email ?? null),
    address_line_1: emptyToNull(input.address_line_1 ?? null),
    address_line_2: emptyToNull(input.address_line_2 ?? null),
    city: emptyToNull(input.city ?? null),
    state: emptyToNull(input.state ?? null),
    postal_code: emptyToNull(input.postal_code ?? null),
    country: input.country?.trim().toUpperCase() ?? "US",
    ...(input.internal_status ? { internal_status: input.internal_status } : {}),
  };

  const { data, error } = await supabase
    .from(TABLES.tenantProfiles)
    .upsert(row, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save business profile.");
  }

  const displayName = row.display_name ?? row.legal_business_name;
  if (displayName) {
    await supabase
      .from(TABLES.tenants)
      .update({ display_name: displayName })
      .eq("id", tenantId);
  }

  await logTenantActivity({
    tenantId,
    actorUserId,
    actorType: "admin",
    action: "tenant_profile.updated",
    entityType: "tenant_profile",
    entityId: tenantId,
    summary: "Updated business profile",
  });

  return data as TenantProfile;
}
