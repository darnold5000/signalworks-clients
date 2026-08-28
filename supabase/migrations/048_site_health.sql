-- Persist admin-only website health snapshots and launch readiness state.
-- Website targets remain authoritative in tenant_portal_settings.

create table if not exists public.tenant_site_health (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  search_console_status text not null default 'not_configured'
    check (search_console_status in ('not_configured', 'manual_setup', 'connected')),
  search_console_property text,
  last_check_status text not null default 'not_configured'
    check (last_check_status in ('healthy', 'needs_attention', 'not_configured', 'error')),
  last_checked_at timestamptz,
  last_check_duration_ms integer check (last_check_duration_ms is null or last_check_duration_ms >= 0),
  last_check_results jsonb not null default '{}'::jsonb,
  launch_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_site_health is
  'Admin-only website health snapshots, Search Console setup state, and launch checklist state.';

create index if not exists tenant_site_health_last_checked_idx
  on public.tenant_site_health (last_checked_at);
create index if not exists tenant_site_health_status_idx
  on public.tenant_site_health (last_check_status);

drop trigger if exists tenant_site_health_set_updated_at on public.tenant_site_health;
create trigger tenant_site_health_set_updated_at
  before update on public.tenant_site_health
  for each row execute function public.set_updated_at();

alter table public.tenant_site_health enable row level security;

drop policy if exists tenant_site_health_select on public.tenant_site_health;
create policy tenant_site_health_select
  on public.tenant_site_health for select to authenticated
  using (public.has_platform_permission('manage_tenants'));

drop policy if exists tenant_site_health_manage on public.tenant_site_health;
create policy tenant_site_health_manage
  on public.tenant_site_health for all to authenticated
  using (public.has_platform_permission('manage_tenants'))
  with check (public.has_platform_permission('manage_tenants'));

grant select, insert, update, delete on table public.tenant_site_health to authenticated, service_role;
