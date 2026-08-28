-- Site Health inclusion is independent from tenant/customer lifecycle state.
-- Disabling this flag never deletes or mutates tenant data.
alter table public.tenant_site_health
  add column if not exists monitoring_enabled boolean not null default true;

comment on column public.tenant_site_health.monitoring_enabled is
  'Controls Site Health dashboard/check inclusion only; it does not affect the tenant or website.';

create index if not exists tenant_site_health_monitoring_enabled_idx
  on public.tenant_site_health (monitoring_enabled);
