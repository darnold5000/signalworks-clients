import type {
  Client,
  ClientStatus,
  HostingStatus,
  SslStatus,
  SubscriptionStatus,
  WebsiteSecurityStatus,
  WebsiteStatus,
} from "@/lib/types";

type PortalSettingsRow = {
  website_status?: WebsiteStatus;
  website_url?: string | null;
  domain?: string | null;
  domain_owner?: string | null;
  registrar?: string | null;
  hosting_platform?: string | null;
  hosting_status?: HostingStatus;
  ssl_status?: SslStatus;
  website_security_status?: WebsiteSecurityStatus | null;
  website_security_https_enabled?: boolean | null;
  website_security_cert_valid?: boolean | null;
  website_security_cert_expires_at?: string | null;
  website_last_updated_at?: string | null;
  database_platform?: string | null;
  plan_name?: string;
  monthly_price_cents?: number;
  currency?: string;
  intro_price_cents?: number | null;
  intro_expires_on?: string | null;
  contract_start_on?: string | null;
  updates_included_per_month?: number;
  updates_used_this_month?: number;
  last_deployment_at?: string | null;
  last_backup_at?: string | null;
  analytics_summary?: string | null;
  estimated_infra_cost_cents?: number;
  support_email?: string | null;
  support_phone?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SubscriptionRow = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_status?: SubscriptionStatus;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
};

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
  tenant_portal_settings?: PortalSettingsRow | PortalSettingsRow[] | null;
  tenant_subscriptions?: SubscriptionRow | SubscriptionRow[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const PRIMARY_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
]);

function pickPrimarySubscription(
  value: SubscriptionRow | SubscriptionRow[] | null | undefined,
): SubscriptionRow | null {
  const rows = !value ? [] : Array.isArray(value) ? value : [value];
  if (rows.length === 0) return null;

  const preferred = rows.find((row) =>
    PRIMARY_SUBSCRIPTION_STATUSES.has(row.subscription_status ?? "none"),
  );
  return preferred ?? rows[0] ?? null;
}

export function mapTenantToClient(row: TenantRow): Client {
  const settings = first(row.tenant_portal_settings);
  const subscription = pickPrimarySubscription(row.tenant_subscriptions);

  return {
    id: row.id,
    slug: row.slug,
    business_name: row.display_name,
    status: row.status,
    website_status: settings?.website_status ?? "building",
    website_url: settings?.website_url ?? null,
    domain: settings?.domain ?? null,
    domain_owner: settings?.domain_owner ?? null,
    registrar: settings?.registrar ?? null,
    hosting_platform: settings?.hosting_platform ?? null,
    hosting_status: settings?.hosting_status ?? "none",
    ssl_status: settings?.ssl_status ?? "none",
    website_security_status: settings?.website_security_status ?? null,
    website_security_https_enabled:
      settings?.website_security_https_enabled ?? null,
    website_security_cert_valid: settings?.website_security_cert_valid ?? null,
    website_security_cert_expires_at:
      settings?.website_security_cert_expires_at ?? null,
    website_last_updated_at: settings?.website_last_updated_at ?? null,
    database_platform: settings?.database_platform ?? null,
    plan_name: settings?.plan_name ?? "Launch",
    monthly_price_cents: settings?.monthly_price_cents ?? 0,
    currency: settings?.currency ?? "usd",
    intro_price_cents: settings?.intro_price_cents ?? null,
    intro_expires_on: settings?.intro_expires_on ?? null,
    contract_start_on: settings?.contract_start_on ?? null,
    updates_included_per_month: settings?.updates_included_per_month ?? 2,
    updates_used_this_month: settings?.updates_used_this_month ?? 0,
    last_deployment_at: settings?.last_deployment_at ?? null,
    last_backup_at: settings?.last_backup_at ?? null,
    analytics_summary: settings?.analytics_summary ?? null,
    stripe_customer_id: subscription?.stripe_customer_id ?? null,
    stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
    stripe_price_id: subscription?.stripe_price_id ?? null,
    subscription_status: subscription?.subscription_status ?? "none",
    current_period_end: subscription?.current_period_end ?? null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    estimated_infra_cost_cents: settings?.estimated_infra_cost_cents ?? 0,
    support_email: settings?.support_email ?? null,
    support_phone: settings?.support_phone ?? null,
    notes: settings?.notes ?? null,
    created_at: settings?.created_at ?? row.created_at,
    updated_at: settings?.updated_at ?? row.updated_at,
  };
}

const TENANT_PORTAL_SETTINGS_SELECT_BASE = `
    website_status,
    website_url,
    domain,
    domain_owner,
    registrar,
    hosting_platform,
    hosting_status,
    ssl_status,
    database_platform,
    plan_name,
    monthly_price_cents,
    currency,
    intro_price_cents,
    intro_expires_on,
    contract_start_on,
    updates_included_per_month,
    updates_used_this_month,
    last_deployment_at,
    last_backup_at,
    analytics_summary,
    estimated_infra_cost_cents,
    support_email,
    support_phone,
    notes,
    created_at,
    updated_at`;

/** Safe when migration 019 (website security columns) is not applied yet. */
export const TENANT_PORTAL_SELECT_COMPAT = `
  id,
  slug,
  display_name,
  status,
  created_at,
  updated_at,
  tenant_portal_settings (
    ${TENANT_PORTAL_SETTINGS_SELECT_BASE}
  ),
  tenant_subscriptions (
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    subscription_status,
    current_period_end,
    cancel_at_period_end
  )
`;

/** Full select after \`019_portal_website_security_catalog.sql\`. */
export const TENANT_PORTAL_SELECT = `
  id,
  slug,
  display_name,
  status,
  created_at,
  updated_at,
  tenant_portal_settings (
    ${TENANT_PORTAL_SETTINGS_SELECT_BASE},
    website_security_status,
    website_security_https_enabled,
    website_security_cert_valid,
    website_security_cert_expires_at,
    website_last_updated_at
  ),
  tenant_subscriptions (
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    subscription_status,
    current_period_end,
    cancel_at_period_end
  )
`;
