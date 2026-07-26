import type { TenantTechnicalProfile } from "@/lib/database/phase1-types";

/** Six sections of the per-client operations inventory. */
export const OPERATIONS_INVENTORY_SECTIONS = [
  "infrastructure",
  "data_platform",
  "business_services",
  "third_party_integrations",
  "signal_works_responsibility",
  "credentials_access",
] as const;

export type OperationsInventorySection =
  (typeof OPERATIONS_INVENTORY_SECTIONS)[number];

export const DEPLOYMENT_ENVIRONMENTS = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "demo", label: "Demo" },
] as const;

export type DeploymentEnvironment =
  (typeof DEPLOYMENT_ENVIRONMENTS)[number]["value"];

export const DOMAIN_REGISTRARS = [
  { value: "godaddy", label: "GoDaddy" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "namecheap", label: "Namecheap" },
  { value: "squarespace", label: "Squarespace" },
  { value: "other", label: "Other" },
] as const;

export const DNS_PROVIDERS = [
  { value: "cloudflare", label: "Cloudflare" },
  { value: "godaddy", label: "GoDaddy" },
  { value: "namecheap", label: "Namecheap" },
  { value: "vercel", label: "Vercel" },
  { value: "other", label: "Other" },
] as const;

export const HOSTING_PLATFORMS = [
  { value: "vercel", label: "Vercel" },
  { value: "cloud_run", label: "Cloud Run" },
  { value: "hostinger", label: "Hostinger" },
  { value: "wordpress", label: "WordPress" },
  { value: "netlify", label: "Netlify" },
  { value: "other", label: "Other" },
] as const;

export const SSL_STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "none", label: "None" },
  { value: "unknown", label: "Unknown" },
] as const;

export const DATABASE_PROVIDERS = [
  { value: "supabase", label: "Supabase" },
  { value: "firebase", label: "Firebase" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "none", label: "None" },
] as const;

export const SUPABASE_PLANS = [
  { value: "hobby", label: "Hobby" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Enterprise" },
  { value: "none", label: "None" },
] as const;

export type SupabasePlan = (typeof SUPABASE_PLANS)[number]["value"];

export const EMAIL_PROVIDERS = [
  { value: "resend", label: "Resend" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
] as const;

export const RESEND_TIERS = [
  { value: "none", label: "None" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
] as const;

export type ResendTier = (typeof RESEND_TIERS)[number]["value"];

export const DOMAIN_EMAIL_PROVIDERS = [
  { value: "google_workspace", label: "Google Workspace" },
  { value: "godaddy", label: "GoDaddy" },
  { value: "microsoft_365", label: "Microsoft 365" },
  { value: "other", label: "Other" },
  { value: "none", label: "None" },
] as const;

export const STRIPE_CONNECTION_STATUSES = [
  { value: "connected", label: "Connected" },
  { value: "pending", label: "Pending" },
  { value: "not_used", label: "Not used" },
] as const;

export type StripeConnectionStatus =
  (typeof STRIPE_CONNECTION_STATUSES)[number]["value"];

/** Major services for ownership matrix (section 5). */
export const SERVICE_OWNERSHIP_KEYS = [
  "domain",
  "dns",
  "hosting",
  "database",
  "email",
  "stripe",
  "analytics",
  "ssl",
  "backups",
  "monitoring",
] as const;

export type ServiceOwnershipKey = (typeof SERVICE_OWNERSHIP_KEYS)[number];

export const SERVICE_OWNERSHIP_LABELS: Record<ServiceOwnershipKey, string> = {
  domain: "Domain",
  dns: "DNS",
  hosting: "Hosting",
  database: "Database",
  email: "Email",
  stripe: "Stripe",
  analytics: "Analytics",
  ssl: "SSL",
  backups: "Backups",
  monitoring: "Monitoring",
};

export const SERVICE_OWNER_VALUES = [
  { value: "signal_works", label: "Signal Works" },
  { value: "client", label: "Client" },
  { value: "shared", label: "Shared responsibility" },
  { value: "", label: "—" },
] as const;

export type ServiceOwner = "signal_works" | "client" | "shared";

export type ServiceOwnershipMap = Partial<Record<ServiceOwnershipKey, ServiceOwner>>;

/** Vendors for access metadata (section 6). */
export const ACCESS_VENDOR_KEYS = [
  "stripe",
  "godaddy",
  "cloudflare",
  "google_workspace",
  "supabase",
  "vercel",
  "resend",
  "github",
] as const;

export type AccessVendorKey = (typeof ACCESS_VENDOR_KEYS)[number];

export const ACCESS_VENDOR_LABELS: Record<AccessVendorKey, string> = {
  stripe: "Stripe",
  godaddy: "GoDaddy",
  cloudflare: "Cloudflare",
  google_workspace: "Google Workspace",
  supabase: "Supabase",
  vercel: "Vercel",
  resend: "Resend",
  github: "GitHub",
};

export type AccessStatusEntry = {
  signal_works_access: boolean;
  client_access: boolean;
  recovery_configured: boolean;
  mfa_enabled: boolean;
  notes: string | null;
};

export const THIRD_PARTY_INTEGRATION_KEYS = [
  "mindbody",
  "trainheroic",
  "trainerize",
  "cal_com",
  "groomore",
  "mailchimp",
  "twilio",
  "google_maps",
  "openai",
  "anthropic",
  "gemini",
] as const;

export type ThirdPartyIntegrationKey =
  (typeof THIRD_PARTY_INTEGRATION_KEYS)[number];

export const THIRD_PARTY_INTEGRATION_LABELS: Record<
  ThirdPartyIntegrationKey,
  string
> = {
  mindbody: "Mindbody",
  trainheroic: "TrainHeroic",
  trainerize: "Trainerize",
  cal_com: "Cal.com",
  groomore: "Groomore",
  mailchimp: "Mailchimp",
  twilio: "Twilio",
  google_maps: "Google Maps",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

export type ThirdPartyIntegrationEntry = {
  enabled: boolean;
  account_owner: string | null;
  notes: string | null;
};

export type BusinessServicesConfig = {
  cloudflare?: { enabled?: boolean; notes?: string | null };
  monitoring?: { enabled?: boolean; notes?: string | null };
  backups?: { enabled?: boolean; notes?: string | null };
};

export type TechnicalInfrastructureSnapshot = {
  deployment_environment: DeploymentEnvironment | null;
  domain_registrar: string | null;
  dns_provider: string | null;
  hosting_provider: string | null;
  database_provider: string | null;
  database_plan: SupabasePlan | null;
  database_shared_platform: boolean | null;
  email_provider: string | null;
  email_provider_tier: ResendTier | null;
  google_workspace_enabled: boolean | null;
  stripe_connection_status: StripeConnectionStatus | null;
};

export type InfrastructureHealthChip = {
  id: string;
  label: string;
  detail: string;
  tone?: "neutral" | "warning" | "success";
};

export type InfrastructureListFilters = {
  supabasePlans: SupabasePlan[];
  domainRegistrars: string[];
  dnsProviders: string[];
  hostingPlatforms: string[];
  stripeConnected: boolean;
  googleWorkspace: boolean;
  resendPro: boolean;
};

export const EMPTY_INFRASTRUCTURE_FILTERS: InfrastructureListFilters = {
  supabasePlans: [],
  domainRegistrars: [],
  dnsProviders: [],
  hostingPlatforms: [],
  stripeConnected: false,
  googleWorkspace: false,
  resendPro: false,
};

// --- Legacy aliases (managed_services booleans) ---
export const MANAGED_SERVICE_KEYS = SERVICE_OWNERSHIP_KEYS.filter(
  (k) => k !== "monitoring",
);
export type ManagedServiceKey = (typeof MANAGED_SERVICE_KEYS)[number];
export const MANAGED_SERVICE_LABELS = SERVICE_OWNERSHIP_LABELS;
export const API_INTEGRATION_KEYS = THIRD_PARTY_INTEGRATION_KEYS;
export const API_INTEGRATION_LABELS = THIRD_PARTY_INTEGRATION_LABELS;
export type ApiIntegrationKey = ThirdPartyIntegrationKey;
export type ApiIntegrationEntry = ThirdPartyIntegrationEntry;

function labelFor<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const match = options.find((o) => o.value === normalized);
  if (match) return match.label;
  return value;
}

function normalizeSlug(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  return v || null;
}

export function parseServiceOwnership(
  raw: unknown,
  legacyManaged?: unknown,
): ServiceOwnershipMap {
  const out: ServiceOwnershipMap = {};
  if (raw && typeof raw === "object") {
    for (const key of SERVICE_OWNERSHIP_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (v === "signal_works" || v === "client" || v === "shared") {
        out[key] = v;
      }
    }
  }
  if (Object.keys(out).length === 0 && legacyManaged && typeof legacyManaged === "object") {
    for (const key of MANAGED_SERVICE_KEYS) {
      if ((legacyManaged as Record<string, unknown>)[key] === true) {
        out[key as ServiceOwnershipKey] = "signal_works";
      }
    }
  }
  return out;
}

export function parseAccessStatus(
  raw: unknown,
): Partial<Record<AccessVendorKey, AccessStatusEntry>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<AccessVendorKey, AccessStatusEntry>> = {};
  for (const key of ACCESS_VENDOR_KEYS) {
    const entry = (raw as Record<string, unknown>)[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[key] = {
      signal_works_access: e.signal_works_access === true,
      client_access: e.client_access === true,
      recovery_configured: e.recovery_configured === true,
      mfa_enabled: e.mfa_enabled === true,
      notes: typeof e.notes === "string" ? e.notes : null,
    };
  }
  return out;
}

export function parseThirdPartyIntegrations(
  raw: unknown,
): Partial<Record<ThirdPartyIntegrationKey, ThirdPartyIntegrationEntry>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<
    Record<ThirdPartyIntegrationKey, ThirdPartyIntegrationEntry>
  > = {};
  for (const key of THIRD_PARTY_INTEGRATION_KEYS) {
    const entry = (raw as Record<string, unknown>)[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out[key] = {
      enabled: Boolean(e.enabled),
      account_owner:
        typeof e.account_owner === "string" ? e.account_owner : null,
      notes: typeof e.notes === "string" ? e.notes : null,
    };
  }
  return out;
}

export function parseBusinessServices(raw: unknown): BusinessServicesConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as BusinessServicesConfig;
}

/** @deprecated Use parseServiceOwnership */
export function parseManagedServices(raw: unknown): Partial<Record<ManagedServiceKey, boolean>> {
  const ownership = parseServiceOwnership(raw);
  const out: Partial<Record<ManagedServiceKey, boolean>> = {};
  for (const key of MANAGED_SERVICE_KEYS) {
    if (ownership[key] === "signal_works") out[key] = true;
  }
  return out;
}

export function parseApiIntegrations(
  raw: unknown,
): Partial<Record<ApiIntegrationKey, ApiIntegrationEntry>> {
  return parseThirdPartyIntegrations(raw);
}

export function parseMonitoringConfig(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const m = raw as Record<string, unknown>;
  return {
    sentry: m.sentry === true,
    uptime_monitoring: m.uptime_monitoring === true,
    backups_dashboard: m.backups_dashboard === true,
    analytics: m.analytics === true,
  };
}

export function infrastructureSnapshotFromProfile(
  technical: TenantTechnicalProfile | null,
): TechnicalInfrastructureSnapshot | null {
  if (!technical) return null;
  return {
    deployment_environment:
      (technical.deployment_environment as DeploymentEnvironment | null) ??
      null,
    domain_registrar: technical.domain_registrar,
    dns_provider: technical.dns_provider,
    hosting_provider: technical.hosting_provider,
    database_provider: technical.database_provider,
    database_plan: (technical.database_plan as SupabasePlan | null) ?? null,
    database_shared_platform: technical.database_shared_platform,
    email_provider: technical.email_provider,
    email_provider_tier:
      (technical.email_provider_tier as ResendTier | null) ?? null,
    google_workspace_enabled: technical.google_workspace_enabled,
    stripe_connection_status:
      (technical.stripe_connection_status as StripeConnectionStatus | null) ??
      null,
  };
}

function dataPlatformDetail(technical: TenantTechnicalProfile): string {
  const parts: string[] = [];
  if (technical.database_project_name) {
    parts.push(technical.database_project_name);
  }
  if (technical.database_project_reference) {
    parts.push(`ref ${technical.database_project_reference}`);
  }
  if (technical.database_shared_platform === true) {
    parts.push("Shared multitenant production DB");
  } else if (technical.database_production_dedicated === true) {
    parts.push("Dedicated production DB");
  } else if (technical.database_shared_platform === false) {
    parts.push("Not on shared platform DB");
  }
  if (technical.backup_policy) parts.push(`Backups: ${technical.backup_policy}`);
  if (technical.database_infrastructure_notes) {
    parts.push(technical.database_infrastructure_notes);
  }
  return parts.join(" · ") || "No data platform details recorded";
}

/** Compact health chips for the clients list (with hover detail). */
export function buildInfrastructureHealthChips(
  technical: TenantTechnicalProfile | null,
): InfrastructureHealthChip[] {
  if (!technical) return [];

  const chips: InfrastructureHealthChip[] = [];

  const dbPlan = labelFor(SUPABASE_PLANS, technical.database_plan);
  if (
    normalizeSlug(technical.database_provider) === "supabase" &&
    dbPlan
  ) {
    chips.push({
      id: "supabase",
      label: `Supabase ${dbPlan}`,
      detail: dataPlatformDetail(technical),
      tone: dbPlan === "Hobby" ? "warning" : "success",
    });
  }

  const hosting = labelFor(HOSTING_PLATFORMS, technical.hosting_provider);
  if (hosting) {
    const deploy =
      labelFor(HOSTING_PLATFORMS, technical.deployment_platform) ?? hosting;
    chips.push({
      id: "hosting",
      label: hosting,
      detail: [
        deploy !== hosting ? `Deploy: ${deploy}` : null,
        technical.hosting_project_name,
        technical.hosting_team_name
          ? `Team: ${technical.hosting_team_name}`
          : null,
        technical.default_branch
          ? `Branch: ${technical.default_branch}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || hosting,
    });
  }

  const stripeStatus = normalizeSlug(technical.stripe_connection_status);
  if (stripeStatus === "connected" || technical.stripe_platform_account_id) {
    chips.push({
      id: "stripe",
      label: "Stripe",
      detail: [
        stripeStatus ? `Status: ${stripeStatus}` : null,
        technical.stripe_platform_account_id,
        technical.stripe_test_mode_enabled ? "Test mode" : null,
        technical.stripe_live_enabled ? "Live enabled" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Stripe connected",
      tone: "success",
    });
  }

  if (technical.google_workspace_enabled) {
    chips.push({
      id: "workspace",
      label: "Workspace",
      detail: "Google Workspace in use",
    });
  }

  const resendTier = normalizeSlug(technical.email_provider_tier);
  if (technical.email_provider === "resend" || resendTier) {
    chips.push({
      id: "resend",
      label: resendTier === "pro" ? "Resend Pro" : "Resend",
      detail: [
        technical.email_sending_domain,
        resendTier ? `Plan: ${resendTier}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Resend",
    });
  }

  return chips;
}

/** Overview / summary strip (may include DNS, registrar, env). */
export function buildInfrastructureSummaryChips(
  technical: TenantTechnicalProfile | null,
): string[] {
  return buildInfrastructureHealthChips(technical).map((c) => c.label);
}

export function hasActiveInfrastructureFilters(
  filters: InfrastructureListFilters,
): boolean {
  return (
    filters.supabasePlans.length > 0 ||
    filters.domainRegistrars.length > 0 ||
    filters.dnsProviders.length > 0 ||
    filters.hostingPlatforms.length > 0 ||
    filters.stripeConnected ||
    filters.googleWorkspace ||
    filters.resendPro
  );
}

export function matchesInfrastructureFilters(
  snapshot: TechnicalInfrastructureSnapshot | null,
  filters: InfrastructureListFilters,
): boolean {
  if (!hasActiveInfrastructureFilters(filters)) return true;
  if (!snapshot) return false;

  if (filters.supabasePlans.length > 0) {
    const plan = snapshot.database_plan;
    const isSupabase =
      normalizeSlug(snapshot.database_provider) === "supabase";
    if (!isSupabase || !plan || !filters.supabasePlans.includes(plan)) {
      return false;
    }
  }

  if (filters.domainRegistrars.length > 0) {
    const reg = normalizeSlug(snapshot.domain_registrar);
    if (!reg || !filters.domainRegistrars.includes(reg)) return false;
  }

  if (filters.dnsProviders.length > 0) {
    const dns = normalizeSlug(snapshot.dns_provider);
    if (!dns || !filters.dnsProviders.includes(dns)) return false;
  }

  if (filters.hostingPlatforms.length > 0) {
    const host = normalizeSlug(snapshot.hosting_provider);
    if (!host || !filters.hostingPlatforms.includes(host)) return false;
  }

  if (filters.stripeConnected) {
    const status = normalizeSlug(snapshot.stripe_connection_status);
    if (status !== "connected") return false;
  }

  if (filters.googleWorkspace) {
    if (!snapshot.google_workspace_enabled) return false;
  }

  if (filters.resendPro) {
    const tier = normalizeSlug(snapshot.email_provider_tier);
    if (tier !== "pro") return false;
  }

  return true;
}

export type OperationsInventorySummary = {
  clientCount: number;
  supabasePro: number;
  supabaseHobby: number;
  vercel: number;
  cloudRun: number;
  godaddy: number;
  cloudflareDns: number;
  stripeConnected: number;
  googleWorkspace: number;
  resendPro: number;
  hobbyDatabaseClients: string[];
  missingMfaAccess: string[];
};

export function aggregateOperationsInventory(
  clients: { id: string; business_name: string; technical: TenantTechnicalProfile | null }[],
): OperationsInventorySummary {
  const summary: OperationsInventorySummary = {
    clientCount: clients.length,
    supabasePro: 0,
    supabaseHobby: 0,
    vercel: 0,
    cloudRun: 0,
    godaddy: 0,
    cloudflareDns: 0,
    stripeConnected: 0,
    googleWorkspace: 0,
    resendPro: 0,
    hobbyDatabaseClients: [],
    missingMfaAccess: [],
  };

  for (const { id, business_name, technical } of clients) {
    if (!technical) continue;
    const plan = normalizeSlug(technical.database_plan);
    const db = normalizeSlug(technical.database_provider);
    if (db === "supabase" && plan === "pro") summary.supabasePro += 1;
    if (db === "supabase" && plan === "hobby") {
      summary.supabaseHobby += 1;
      summary.hobbyDatabaseClients.push(business_name);
    }
    const host = normalizeSlug(technical.hosting_provider);
    if (host === "vercel") summary.vercel += 1;
    if (host === "cloud_run") summary.cloudRun += 1;
    if (normalizeSlug(technical.domain_registrar) === "godaddy") {
      summary.godaddy += 1;
    }
    if (normalizeSlug(technical.dns_provider) === "cloudflare") {
      summary.cloudflareDns += 1;
    }
    if (normalizeSlug(technical.stripe_connection_status) === "connected") {
      summary.stripeConnected += 1;
    }
    if (technical.google_workspace_enabled) summary.googleWorkspace += 1;
    if (normalizeSlug(technical.email_provider_tier) === "pro") {
      summary.resendPro += 1;
    }

    const access = parseAccessStatus(technical.access_status);
    const vendorsNeedingMfa = Object.entries(access).filter(
      ([, entry]) => entry && entry.signal_works_access && !entry.mfa_enabled,
    );
    if (vendorsNeedingMfa.length > 0) {
      summary.missingMfaAccess.push(business_name);
    }
    void id;
  }

  return summary;
}
