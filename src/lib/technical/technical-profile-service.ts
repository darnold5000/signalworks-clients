import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import type { TechnicalProfileUpdateInput } from "@/lib/technical/technical-profile-schema";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function upsertTenantTechnicalProfile(
  tenantId: string,
  input: TechnicalProfileUpdateInput,
  supabaseClient?: SupabaseClient,
): Promise<TenantTechnicalProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = supabaseClient ?? (await createClient());
    const row = {
    tenant_id: tenantId,
    ...input,
    monitoring_config: input.monitoring_config ?? {},
    api_integrations: input.api_integrations ?? {},
    managed_services: input.managed_services ?? {},
    service_ownership: input.service_ownership ?? {},
    access_status: input.access_status ?? {},
    business_services: input.business_services ?? {},
  };

  const { data, error } = await supabase
    .from(TABLES.tenantTechnicalProfiles)
    .upsert(row, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TenantTechnicalProfile;
}
