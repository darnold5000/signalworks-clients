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
    ...Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ),
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
