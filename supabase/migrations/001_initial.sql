-- Signal Works Client Portal schema for the shared Dugout Intel Supabase project.
-- Creates ONLY sw_* tables, functions, triggers, and policies.
-- Do NOT use unprefixed names (profiles, clients, etc.) — those collide with other apps.

create extension if not exists "pgcrypto";

create or replace function public.sw_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sw_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sw_clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  business_name text not null,
  status text not null default 'onboarding'
    check (status in ('active', 'onboarding', 'paused', 'canceled', 'past_due')),
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
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_status text not null default 'none'
    check (subscription_status in (
      'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid', 'none'
    )),
  current_period_end timestamptz,
  estimated_infra_cost_cents integer not null default 0,
  support_email text,
  support_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sw_clients_status_idx on public.sw_clients (status);
create index if not exists sw_clients_stripe_customer_idx
  on public.sw_clients (stripe_customer_id);

create table if not exists public.sw_client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sw_clients (id) on delete cascade,
  profile_id uuid not null references public.sw_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, profile_id)
);

create index if not exists sw_client_members_profile_idx
  on public.sw_client_members (profile_id);

create table if not exists public.sw_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sw_clients (id) on delete cascade,
  created_by uuid references public.sw_profiles (id) on delete set null,
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

create index if not exists sw_service_requests_client_idx
  on public.sw_service_requests (client_id, created_at desc);

create table if not exists public.sw_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sw_clients (id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists sw_profiles_updated_at on public.sw_profiles;
create trigger sw_profiles_updated_at
  before update on public.sw_profiles
  for each row execute function public.sw_set_updated_at();

drop trigger if exists sw_clients_updated_at on public.sw_clients;
create trigger sw_clients_updated_at
  before update on public.sw_clients
  for each row execute function public.sw_set_updated_at();

drop trigger if exists sw_service_requests_updated_at on public.sw_service_requests;
create trigger sw_service_requests_updated_at
  before update on public.sw_service_requests
  for each row execute function public.sw_set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create sw_profiles row on signup
-- ---------------------------------------------------------------------------

create or replace function public.sw_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sw_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists sw_on_auth_user_created on auth.users;
create trigger sw_on_auth_user_created
  after insert on auth.users
  for each row execute function public.sw_handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.sw_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sw_profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  );
$$;

create or replace function public.sw_is_client_member(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sw_client_members m
    where m.client_id = p_client_id and m.profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sw_profiles enable row level security;
alter table public.sw_clients enable row level security;
alter table public.sw_client_members enable row level security;
alter table public.sw_service_requests enable row level security;
alter table public.sw_documents enable row level security;

drop policy if exists "sw_users_read_own_profile" on public.sw_profiles;
create policy "sw_users_read_own_profile"
  on public.sw_profiles for select
  using (id = auth.uid() or public.sw_is_admin());

drop policy if exists "sw_users_update_own_profile" on public.sw_profiles;
create policy "sw_users_update_own_profile"
  on public.sw_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "sw_admins_manage_profiles" on public.sw_profiles;
create policy "sw_admins_manage_profiles"
  on public.sw_profiles for all
  using (public.sw_is_admin())
  with check (public.sw_is_admin());

drop policy if exists "sw_members_read_own_clients" on public.sw_clients;
create policy "sw_members_read_own_clients"
  on public.sw_clients for select
  using (public.sw_is_client_member(id) or public.sw_is_admin());

drop policy if exists "sw_admins_manage_clients" on public.sw_clients;
create policy "sw_admins_manage_clients"
  on public.sw_clients for all
  using (public.sw_is_admin())
  with check (public.sw_is_admin());

drop policy if exists "sw_members_see_membership" on public.sw_client_members;
create policy "sw_members_see_membership"
  on public.sw_client_members for select
  using (profile_id = auth.uid() or public.sw_is_admin());

drop policy if exists "sw_admins_manage_membership" on public.sw_client_members;
create policy "sw_admins_manage_membership"
  on public.sw_client_members for all
  using (public.sw_is_admin())
  with check (public.sw_is_admin());

drop policy if exists "sw_members_read_requests" on public.sw_service_requests;
create policy "sw_members_read_requests"
  on public.sw_service_requests for select
  using (public.sw_is_client_member(client_id) or public.sw_is_admin());

drop policy if exists "sw_members_create_requests" on public.sw_service_requests;
create policy "sw_members_create_requests"
  on public.sw_service_requests for insert
  with check (public.sw_is_client_member(client_id) or public.sw_is_admin());

drop policy if exists "sw_admins_update_requests" on public.sw_service_requests;
create policy "sw_admins_update_requests"
  on public.sw_service_requests for update
  using (public.sw_is_admin())
  with check (public.sw_is_admin());

drop policy if exists "sw_members_read_documents" on public.sw_documents;
create policy "sw_members_read_documents"
  on public.sw_documents for select
  using (public.sw_is_client_member(client_id) or public.sw_is_admin());

drop policy if exists "sw_admins_manage_documents" on public.sw_documents;
create policy "sw_admins_manage_documents"
  on public.sw_documents for all
  using (public.sw_is_admin())
  with check (public.sw_is_admin());
