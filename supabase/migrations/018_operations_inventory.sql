-- Operations inventory: ownership, access metadata, SSL, production DB flag.

alter table public.tenant_technical_profiles
  add column if not exists deployment_platform text,
  add column if not exists ssl_status text
    check (
      ssl_status is null
      or ssl_status in ('active', 'pending', 'expiring_soon', 'none', 'unknown')
    ),
  add column if not exists database_production_dedicated boolean,
  add column if not exists service_ownership jsonb not null default '{}'::jsonb,
  add column if not exists access_status jsonb not null default '{}'::jsonb,
  add column if not exists business_services jsonb not null default '{}'::jsonb;

comment on table public.tenant_technical_profiles is
  'Per-tenant operations inventory (hosting, data platform, business services, integrations, ownership, access metadata). No secrets.';

comment on column public.tenant_technical_profiles.service_ownership is
  'Per-service owner: signal_works | client | shared';
comment on column public.tenant_technical_profiles.access_status is
  'Per-vendor access metadata (no passwords): SW access, client access, recovery, MFA';
comment on column public.tenant_technical_profiles.business_services is
  'Optional flags/notes for Cloudflare, monitoring, backups when not captured elsewhere';
