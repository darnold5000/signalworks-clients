import { describe, expect, it } from "vitest";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import {
  buildInfrastructureHealthChips,
  matchesInfrastructureFilters,
  type InfrastructureListFilters,
  type SupabasePlan,
} from "@/lib/technical/operations-inventory";

function technical(
  partial: Partial<TenantTechnicalProfile>,
): TenantTechnicalProfile {
  return {
    tenant_id: "t1",
    architecture_type: null,
    repository_provider: null,
    repository_owner: null,
    repository_name: null,
    repository_url: null,
    default_branch: null,
    hosting_provider: null,
    hosting_project_name: null,
    hosting_project_id: null,
    production_url: null,
    domain_registrar: null,
    dns_provider: null,
    primary_domain: null,
    database_provider: null,
    database_project_name: null,
    database_project_reference: null,
    database_region: null,
    database_schema_name: null,
    storage_provider: null,
    storage_bucket_names: null,
    stripe_account_type: null,
    stripe_connected_account_id: null,
    email_provider: null,
    email_sending_domain: null,
    analytics_provider: null,
    analytics_property_id: null,
    source_code_ownership: null,
    backup_policy: null,
    last_backup_verified_at: null,
    deployment_notes: null,
    technical_notes: null,
    deployment_environment: null,
    database_plan: null,
    database_shared_platform: null,
    database_infrastructure_notes: null,
    email_provider_tier: null,
    google_workspace_enabled: null,
    domain_email_provider: null,
    stripe_connection_status: null,
    stripe_platform_account_id: null,
    stripe_test_mode_enabled: null,
    stripe_live_enabled: null,
    hosting_team_name: null,
    hosting_auto_deploy: null,
    monitoring_config: null,
    api_integrations: null,
    managed_services: null,
    database_production_dedicated: null,
    deployment_platform: null,
    ssl_status: null,
    service_ownership: null,
    access_status: null,
    business_services: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

const emptyFilters: InfrastructureListFilters = {
  supabasePlans: [],
  domainRegistrars: [],
  dnsProviders: [],
  hostingPlatforms: [],
  stripeConnected: false,
  googleWorkspace: false,
  resendPro: false,
};

describe("operations inventory", () => {
  it("builds health chips with hover detail", () => {
    const chips = buildInfrastructureHealthChips(
      technical({
        database_provider: "supabase",
        database_plan: "pro",
        database_shared_platform: false,
        database_production_dedicated: true,
        hosting_provider: "vercel",
        hosting_team_name: "Signal Works",
        google_workspace_enabled: true,
        email_provider: "resend",
        email_provider_tier: "pro",
        stripe_connection_status: "connected",
      }),
    );
    const labels = chips.map((c) => c.label);
    expect(labels).toContain("Supabase Pro");
    expect(labels).toContain("Vercel");
    expect(labels).toContain("Stripe");
    expect(labels).toContain("Workspace");
    expect(labels).toContain("Resend Pro");
    const supabase = chips.find((c) => c.id === "supabase");
    expect(supabase?.detail).toContain("Dedicated production DB");
  });

  it("filters clients by supabase plan and registrar", () => {
    const snapshot = {
      deployment_environment: null,
      domain_registrar: "godaddy",
      dns_provider: null,
      hosting_provider: null,
      database_provider: "supabase",
      database_plan: "hobby" as const,
      database_shared_platform: false,
      email_provider: null,
      email_provider_tier: null,
      google_workspace_enabled: false,
      stripe_connection_status: null,
    };
    expect(
      matchesInfrastructureFilters(snapshot, {
        ...emptyFilters,
        supabasePlans: ["hobby"] as SupabasePlan[],
      }),
    ).toBe(true);
    expect(
      matchesInfrastructureFilters(snapshot, {
        ...emptyFilters,
        supabasePlans: ["pro"] as SupabasePlan[],
      }),
    ).toBe(false);
    expect(
      matchesInfrastructureFilters(snapshot, {
        ...emptyFilters,
        domainRegistrars: ["godaddy"],
      }),
    ).toBe(true);
    expect(
      matchesInfrastructureFilters(snapshot, {
        ...emptyFilters,
        dnsProviders: ["cloudflare"],
      }),
    ).toBe(false);
  });
});
