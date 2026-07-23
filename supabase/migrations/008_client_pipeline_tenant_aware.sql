-- Tenant-scoped client pipeline for Signal Works internal sales outreach.
--
-- Prerequisites (must be confirmed via live SQL Editor audit before applying):
--   public.set_updated_at()
--   public.is_tenant_member(uuid)
--   public.has_platform_permission(text)
--   public.tenants.slug UNIQUE NOT NULL
--   exactly one tenants row: slug = 'signalworks', platform_category = 'internal'
--   platform_admin + active membership on signalworks for admin users
--   permission name 'manage_tenants' on platform_admin (permissions.name, not slug)
--
-- Does NOT replace or modify 006_client_pipeline.sql (never applied on live DB).
-- Supersedes the intent of 007_client_pipeline_grants.sql.
--
-- RLS note: policies do NOT subquery public.tenants directly because tenants has RLS.
-- Use is_signalworks_internal_tenant(tenant_id) instead (security definer, boolean only).

-- ---------------------------------------------------------------------------
-- Helper: verify a tenant UUID is the Signal Works internal tenant
-- ---------------------------------------------------------------------------

create or replace function public.is_signalworks_internal_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = target_tenant_id
      and t.slug = 'signalworks'
      and t.platform_category = 'internal'
  );
$$;

comment on function public.is_signalworks_internal_tenant(uuid) is
  'True when target_tenant_id is the Signal Works internal tenant '
  '(slug signalworks, platform_category internal). '
  'Security definer to avoid tenants RLS blocking pipeline policy evaluation. '
  'Returns only a boolean; does not expose tenant rows.';

grant execute on function public.is_signalworks_internal_tenant(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.client_pipeline (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants (id) on delete cascade,

  business_name text not null,
  contact_name text not null,

  status text not null default 'potential'
    check (
      status in (
        'potential',
        'reached_out',
        'contact_made',
        'conversation_ongoing',
        'proposal_sent',
        'won',
        'not_interested'
      )
    ),

  last_conversation text,
  plan text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_pipeline_tenant_updated_idx
  on public.client_pipeline (tenant_id, updated_at desc);

create index client_pipeline_tenant_status_idx
  on public.client_pipeline (tenant_id, status);

drop trigger if exists client_pipeline_set_updated_at on public.client_pipeline;
create trigger client_pipeline_set_updated_at
  before update on public.client_pipeline
  for each row execute function public.set_updated_at();

alter table public.client_pipeline enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- All operations require:
--   1) row tenant_id is the Signal Works internal tenant (helper)
--   2) caller is an active member of that tenant
--   3) caller has manage_tenants (temporary — replace with manage_client_pipeline)
-- ---------------------------------------------------------------------------

drop policy if exists client_pipeline_select on public.client_pipeline;
create policy client_pipeline_select
  on public.client_pipeline for select
  to authenticated
  using (
    public.is_signalworks_internal_tenant(tenant_id)
    and public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_tenants')
  );

drop policy if exists client_pipeline_insert on public.client_pipeline;
create policy client_pipeline_insert
  on public.client_pipeline for insert
  to authenticated
  with check (
    public.is_signalworks_internal_tenant(tenant_id)
    and public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_tenants')
  );

drop policy if exists client_pipeline_update on public.client_pipeline;
create policy client_pipeline_update
  on public.client_pipeline for update
  to authenticated
  using (
    public.is_signalworks_internal_tenant(tenant_id)
    and public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_tenants')
  )
  with check (
    public.is_signalworks_internal_tenant(tenant_id)
    and public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_tenants')
  );

drop policy if exists client_pipeline_delete on public.client_pipeline;
create policy client_pipeline_delete
  on public.client_pipeline for delete
  to authenticated
  using (
    public.is_signalworks_internal_tenant(tenant_id)
    and public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_tenants')
  );

grant select, insert, update, delete on table public.client_pipeline
  to authenticated, service_role;
