-- Structured infrastructure & integrations on tenant technical profiles (admin ops inventory).

alter table public.tenant_technical_profiles
  add column if not exists deployment_environment text
    check (
      deployment_environment is null
      or deployment_environment in ('production', 'staging', 'demo')
    ),
  add column if not exists database_plan text
    check (
      database_plan is null
      or database_plan in ('hobby', 'pro', 'team', 'enterprise', 'none')
    ),
  add column if not exists database_shared_platform boolean,
  add column if not exists database_infrastructure_notes text,
  add column if not exists email_provider_tier text
    check (
      email_provider_tier is null
      or email_provider_tier in ('none', 'free', 'pro')
    ),
  add column if not exists google_workspace_enabled boolean,
  add column if not exists domain_email_provider text,
  add column if not exists stripe_connection_status text
    check (
      stripe_connection_status is null
      or stripe_connection_status in ('connected', 'pending', 'not_used')
    ),
  add column if not exists stripe_platform_account_id text,
  add column if not exists stripe_test_mode_enabled boolean,
  add column if not exists stripe_live_enabled boolean,
  add column if not exists hosting_team_name text,
  add column if not exists hosting_auto_deploy boolean,
  add column if not exists monitoring_config jsonb not null default '{}'::jsonb,
  add column if not exists api_integrations jsonb not null default '{}'::jsonb,
  add column if not exists managed_services jsonb not null default '{}'::jsonb;

comment on column public.tenant_technical_profiles.domain_registrar is
  'Normalized slug: godaddy, cloudflare, namecheap, squarespace, other';
comment on column public.tenant_technical_profiles.dns_provider is
  'Normalized slug: cloudflare, godaddy, namecheap, vercel, other';
comment on column public.tenant_technical_profiles.hosting_provider is
  'Normalized slug: vercel, cloud_run, hostinger, wordpress, netlify, other';
comment on column public.tenant_technical_profiles.database_provider is
  'Normalized slug: supabase, firebase, postgresql, none';
comment on column public.tenant_technical_profiles.email_provider is
  'Normalized slug: resend, none, other';

create index if not exists tenant_technical_profiles_database_plan_idx
  on public.tenant_technical_profiles (database_plan)
  where database_plan is not null;

create index if not exists tenant_technical_profiles_domain_registrar_idx
  on public.tenant_technical_profiles (domain_registrar)
  where domain_registrar is not null;

create index if not exists tenant_technical_profiles_hosting_provider_idx
  on public.tenant_technical_profiles (hosting_provider)
  where hosting_provider is not null;

create index if not exists tenant_technical_profiles_stripe_connection_idx
  on public.tenant_technical_profiles (stripe_connection_status)
  where stripe_connection_status is not null;

create index if not exists tenant_technical_profiles_google_workspace_idx
  on public.tenant_technical_profiles (google_workspace_enabled)
  where google_workspace_enabled is true;

create index if not exists tenant_technical_profiles_email_tier_idx
  on public.tenant_technical_profiles (email_provider_tier)
  where email_provider_tier is not null;
