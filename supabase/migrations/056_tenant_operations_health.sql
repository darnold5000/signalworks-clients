-- Cached operational / infrastructure health for admin Clients dashboard.
-- Provider refresh jobs write here; UI reads cache only (no live API on page load).

alter table public.tenant_technical_profiles
  add column if not exists uptime_robot_monitor_id text;

comment on column public.tenant_technical_profiles.uptime_robot_monitor_id is
  'UptimeRobot monitor id for this client. API key stays server-side only.';

create table if not exists public.tenant_operations_health (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  overall_status text not null default 'not_configured'
    check (
      overall_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),

  website_status text not null default 'not_configured'
    check (
      website_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  website_response_ms integer
    check (website_response_ms is null or website_response_ms >= 0),
  website_uptime_24h numeric(7, 4)
    check (
      website_uptime_24h is null
      or (website_uptime_24h >= 0 and website_uptime_24h <= 100)
    ),
  website_uptime_7d numeric(7, 4)
    check (
      website_uptime_7d is null
      or (website_uptime_7d >= 0 and website_uptime_7d <= 100)
    ),
  website_uptime_30d numeric(7, 4)
    check (
      website_uptime_30d is null
      or (website_uptime_30d >= 0 and website_uptime_30d <= 100)
    ),

  ssl_status text not null default 'not_configured'
    check (
      ssl_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  ssl_issuer text,
  ssl_valid_from timestamptz,
  ssl_expires_at timestamptz,
  ssl_days_remaining integer,

  domain_status text not null default 'not_configured'
    check (
      domain_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  domain_expires_at timestamptz,
  domain_days_remaining integer,

  vercel_status text not null default 'not_configured'
    check (
      vercel_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  vercel_last_deployment_status text,
  vercel_last_deployment_at timestamptz,

  supabase_status text not null default 'not_configured'
    check (
      supabase_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  supabase_database_status text,
  supabase_auth_status text,
  supabase_storage_status text,

  twilio_status text not null default 'not_configured'
    check (
      twilio_status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  twilio_sms_count_month integer
    check (twilio_sms_count_month is null or twilio_sms_count_month >= 0),
  twilio_sms_cost_month numeric(12, 4),
  twilio_failed_sms_month integer
    check (twilio_failed_sms_month is null or twilio_failed_sms_month >= 0),

  last_checked_at timestamptz,
  last_error text,
  providers jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_operations_health is
  'Admin-only cached operational health snapshot per client tenant.';

create index if not exists tenant_operations_health_overall_status_idx
  on public.tenant_operations_health (overall_status);

create index if not exists tenant_operations_health_last_checked_idx
  on public.tenant_operations_health (last_checked_at);

drop trigger if exists tenant_operations_health_set_updated_at
  on public.tenant_operations_health;

create trigger tenant_operations_health_set_updated_at
  before update on public.tenant_operations_health
  for each row execute function public.set_updated_at();

alter table public.tenant_operations_health enable row level security;

drop policy if exists tenant_operations_health_select
  on public.tenant_operations_health;

create policy tenant_operations_health_select
  on public.tenant_operations_health for select to authenticated
  using (public.has_platform_permission('manage_tenants'));

drop policy if exists tenant_operations_health_manage
  on public.tenant_operations_health;

create policy tenant_operations_health_manage
  on public.tenant_operations_health for all to authenticated
  using (public.has_platform_permission('manage_tenants'))
  with check (public.has_platform_permission('manage_tenants'));

grant select, insert, update, delete on table public.tenant_operations_health
  to authenticated, service_role;

-- Per-provider refresh metadata (independent failure domains).

create table if not exists public.tenant_operations_health_providers (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null
    check (
      provider in (
        'uptimerobot',
        'ssl',
        'domain',
        'vercel',
        'supabase',
        'twilio'
      )
    ),
  status text not null default 'not_configured'
    check (
      status in (
        'healthy',
        'warning',
        'critical',
        'unknown',
        'not_configured'
      )
    ),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

comment on table public.tenant_operations_health_providers is
  'Per-provider operational health check state and last error for a tenant.';

create index if not exists tenant_operations_health_providers_status_idx
  on public.tenant_operations_health_providers (provider, status);

drop trigger if exists tenant_operations_health_providers_set_updated_at
  on public.tenant_operations_health_providers;

create trigger tenant_operations_health_providers_set_updated_at
  before update on public.tenant_operations_health_providers
  for each row execute function public.set_updated_at();

alter table public.tenant_operations_health_providers enable row level security;

drop policy if exists tenant_operations_health_providers_select
  on public.tenant_operations_health_providers;

create policy tenant_operations_health_providers_select
  on public.tenant_operations_health_providers for select to authenticated
  using (public.has_platform_permission('manage_tenants'));

drop policy if exists tenant_operations_health_providers_manage
  on public.tenant_operations_health_providers;

create policy tenant_operations_health_providers_manage
  on public.tenant_operations_health_providers for all to authenticated
  using (public.has_platform_permission('manage_tenants'))
  with check (public.has_platform_permission('manage_tenants'));

grant select, insert, update, delete
  on table public.tenant_operations_health_providers
  to authenticated, service_role;
