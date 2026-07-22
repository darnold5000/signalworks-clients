-- Signal Works admin client pipeline (sales outreach tracking).
-- Run this entire file in one execution (SQL editor: select all → run).
--
-- Prerequisites (apply first if missing):
--   signalworks-platform/core/supabase/migrations/001_platform_foundation.sql
--   signalworks-platform/core/supabase/migrations/002_has_platform_permission_global_roles_only.sql

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Required by RLS policies below (no-op if platform tables are missing).
create or replace function public.has_platform_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.roles r on r.id = tm.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where tm.user_id = auth.uid()
      and tm.status = 'active'
      and r.tenant_id is null
      and p.name = permission_name
  );
$$;

grant execute on function public.has_platform_permission(text) to authenticated, service_role;

create table if not exists public.client_pipeline (
  id uuid primary key default gen_random_uuid(),

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

create index if not exists client_pipeline_status_idx
  on public.client_pipeline (status);

create index if not exists client_pipeline_updated_at_idx
  on public.client_pipeline (updated_at desc);

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'client_pipeline'
  ) then
    drop trigger if exists client_pipeline_set_updated_at on public.client_pipeline;
    create trigger client_pipeline_set_updated_at
      before update on public.client_pipeline
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.client_pipeline enable row level security;

drop policy if exists client_pipeline_select on public.client_pipeline;
create policy client_pipeline_select
  on public.client_pipeline for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('view_all_tenants')
  );

drop policy if exists client_pipeline_insert on public.client_pipeline;
create policy client_pipeline_insert
  on public.client_pipeline for insert
  to authenticated
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );

drop policy if exists client_pipeline_update on public.client_pipeline;
create policy client_pipeline_update
  on public.client_pipeline for update
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );

drop policy if exists client_pipeline_delete on public.client_pipeline;
create policy client_pipeline_delete
  on public.client_pipeline for delete
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );
