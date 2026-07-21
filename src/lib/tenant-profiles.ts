import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { TenantOnboardingStatus } from "@/lib/database/phase1-types";

export async function ensureTenantProfile(args: {
  tenantId: string;
  displayName: string;
  primaryContactEmail?: string | null;
  websiteUrl?: string | null;
  primaryDomain?: string | null;
  internalStatus?: "invited" | "onboarding";
  onboardingStatus?: TenantOnboardingStatus;
}) {
  const supabase = createServiceClient();
  await supabase.from(TABLES.tenantProfiles).upsert(
    {
      tenant_id: args.tenantId,
      display_name: args.displayName,
      legal_business_name: args.displayName,
      primary_contact_email: args.primaryContactEmail ?? null,
      website_url: args.websiteUrl ?? null,
      primary_domain: args.primaryDomain ?? null,
      internal_status: args.internalStatus ?? "invited",
      onboarding_status: args.onboardingStatus ?? "invited",
    },
    { onConflict: "tenant_id" },
  );
}
