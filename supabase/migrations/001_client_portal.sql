-- Signal Works Client Portal — tenant-aware schema (ADR 0001–0003).
-- Requires: signalworks-platform/core/supabase/migrations/001_platform_foundation.sql

-- ---------------------------------------------------------------------------
-- Tenant portal extension (managed website customers)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_portal_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  website_status text not null default 'building'
    check (website_status in ('live', 'building', 'staging', 'offline')),
  website_url text,
  domain text,
  domain_owner text,
  registrar text,
  hosting_platform text,
  hosting_status text not null default 'none'
    check (hosting_status in ('active', 'pending', 'error', 'none')),
  ssl_status text not null default 'none'
    check (ssl_status in ('active', 'pending', 'error', 'none')),
  database_platform text,
  plan_name text not null default 'Launch',
  monthly_price_cents integer not null default 0,
  currency text not null default 'usd',
  intro_price_cents integer,
  intro_expires_on date,
  contract_start_on date,
  updates_included_per_month integer not null default 2,
  updates_used_this_month integer not null default 0,
  last_deployment_at timestamptz,
  last_backup_at timestamptz,
  analytics_summary text,
  estimated_infra_cost_cents integer not null default 0,
  support_email text,
  support_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stripe subscription mirror at tenant scope (distinct from member billing subscriptions).
create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_status text not null default 'none'
    check (subscription_status in (
      'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid', 'none'
    )),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_subscriptions_stripe_customer_idx
  on public.tenant_subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Portal operational tables
-- ---------------------------------------------------------------------------

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  request_type text not null default 'other'
    check (request_type in (
      'text_change', 'new_photo', 'hours_update', 'new_service',
      'scheduling_update', 'new_page_or_feature', 'other'
    )),
  title text not null,
  description text not null,
  status text not null default 'submitted'
    check (status in (
      'submitted', 'in_progress', 'waiting_on_client', 'completed', 'canceled'
    )),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists service_requests_tenant_idx
  on public.service_requests (tenant_id, created_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_idx
  on public.documents (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists tenant_portal_settings_set_updated_at on public.tenant_portal_settings;
create trigger tenant_portal_settings_set_updated_at
  before update on public.tenant_portal_settings
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_subscriptions_set_updated_at on public.tenant_subscriptions;
create trigger tenant_subscriptions_set_updated_at
  before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists service_requests_set_updated_at on public.service_requests;
create trigger service_requests_set_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.tenant_portal_settings enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.service_requests enable row level security;
alter table public.documents enable row level security;

drop policy if exists tenant_portal_settings_select on public.tenant_portal_settings;
create policy tenant_portal_settings_select
  on public.tenant_portal_settings for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
  );

drop policy if exists tenant_portal_settings_manage on public.tenant_portal_settings;
create policy tenant_portal_settings_manage
  on public.tenant_portal_settings for all
  to authenticated
  using (public.has_platform_permission('manage_tenants'))
  with check (public.has_platform_permission('manage_tenants'));

drop policy if exists tenant_subscriptions_select on public.tenant_subscriptions;
create policy tenant_subscriptions_select
  on public.tenant_subscriptions for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_tenant_permission(tenant_id, 'manage_billing')
  );

drop policy if exists tenant_subscriptions_manage on public.tenant_subscriptions;
create policy tenant_subscriptions_manage
  on public.tenant_subscriptions for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_tenant_permission(tenant_id, 'manage_billing')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_tenant_permission(tenant_id, 'manage_billing')
  );

drop policy if exists service_requests_select on public.service_requests;
create policy service_requests_select
  on public.service_requests for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
  );

drop policy if exists service_requests_insert on public.service_requests;
create policy service_requests_insert
  on public.service_requests for insert
  to authenticated
  with check (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
  );

drop policy if exists service_requests_update on public.service_requests;
create policy service_requests_update
  on public.service_requests for update
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_tenant_permission(tenant_id, 'manage_website')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_tenant_permission(tenant_id, 'manage_website')
  );

drop policy if exists documents_select on public.documents;
create policy documents_select
  on public.documents for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
  );

drop policy if exists documents_manage on public.documents;
create policy documents_manage
  on public.documents for all
  to authenticated
  using (public.has_platform_permission('manage_tenants'))
  with check (public.has_platform_permission('manage_tenants'));
