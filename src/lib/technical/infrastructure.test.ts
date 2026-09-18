import { describe, expect, it } from "vitest";
import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";
import {
  activeThirdPartyIntegrationNames,
  buildInfrastructureHealthChips,
  buildTechnologyServiceRows,
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
    payment_provider: null,
    payment_method_notes: null,
    sms_provider: null,
    twilio_account_sid: null,
    twilio_phone_number: null,
    twilio_number_type: null,
    sms_enabled: null,
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

describe("technology and services inventory", () => {
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

  it("renders no rows for an empty client and hides unset values", () => {
    expect(
      buildTechnologyServiceRows({ technical: technical({}) }),
    ).toEqual([]);
  });

  it("renders a minimally configured website", () => {
    expect(
      buildTechnologyServiceRows({
        technical: null,
        clientWebsiteUrl: "https://example.com/path",
      }),
    ).toEqual([
      { id: "website", label: "Website", value: "example.com", details: [] },
    ]);
  });

  it("renders the full Signal Works stack as a scan-friendly summary", () => {
    const rows = buildTechnologyServiceRows({
      technical: technical({
        primary_domain: "example.com",
        domain_registrar: "cloudflare",
        hosting_provider: "vercel",
        database_provider: "supabase",
        repository_owner: "Signal Works",
        payment_provider: "stripe",
        stripe_platform_account_id: "acct_example",
        email_provider: "resend",
        email_sending_domain: "mail.example.com",
        sms_provider: "twilio",
        twilio_account_sid: "ACexample",
        twilio_phone_number: "+13175550123",
        twilio_number_type: "toll_free",
        sms_enabled: true,
        api_integrations: {
          mindbody: { enabled: true, name: null, account_owner: null, notes: null },
          custom_health_connect: { enabled: true, name: "Health Connect", account_owner: null, notes: null },
        },
      }),
    });

    expect(rows.map((row) => row.label)).toEqual([
      "Website",
      "Domain",
      "Hosting",
      "Database",
      "Source",
      "Payments",
      "Email",
      "SMS",
      "Integrations",
    ]);
    expect(rows.find((row) => row.id === "payments")).toMatchObject({
      value: "Stripe",
      details: ["acct_example"],
    });
    expect(rows.find((row) => row.id === "sms")).toMatchObject({
      value: "Twilio",
      details: ["Toll-Free · +13175550123", "ACexample", "SMS enabled"],
    });
    expect(rows.find((row) => row.id === "integrations")?.value).toBe(
      "Mindbody · Health Connect",
    );
  });

  it("supports manual payments and Twilio local numbers", () => {
    const rows = buildTechnologyServiceRows({
      technical: technical({
        payment_provider: "manual",
        payment_method_notes: "External invoice",
        sms_provider: "twilio",
        twilio_phone_number: "+13175550124",
        twilio_number_type: "local",
        sms_enabled: false,
      }),
    });

    expect(rows.find((row) => row.id === "payments")).toMatchObject({
      value: "Manual",
      details: ["External invoice"],
    });
    expect(rows.find((row) => row.id === "sms")?.details).toEqual([
      "Local · +13175550124",
    ]);
  });

  it("converts enabled legacy integration entries to names", () => {
    expect(
      activeThirdPartyIntegrationNames({
        google_maps: { enabled: true },
        trainerize: { enabled: true },
        twilio: { enabled: true },
        disabled: { enabled: false, name: "Disabled" },
      }),
    ).toEqual(["Google Maps", "Trainerize"]);
  });
});
