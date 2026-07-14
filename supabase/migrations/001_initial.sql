-- Signal Works Client Portal schema
-- Run against a dedicated Supabase project (not a client site DB).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('client', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'client',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients (managed websites / subscriptions)
-- ---------------------------------------------------------------------------
create type public.client_status as enum (
  'active',
  'onboarding',
  'paused',
  'canceled',
  'past_due'
);

create type public.website_status as enum (
  'live',
  'building',
  'staging',
  'offline'
);

create type public.hosting_status as enum (
  'active',
  'pending',
  'error',
  'none'
);

create type public.ssl_status as enum (
  'active',
  'pending',
  'error',
  'none'
);

create type public.subscription_status as enum (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'unpaid',
  'none'
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  business_name text not null,
  status public.client_status not null default 'onboarding',
  website_status public.website_status not null default 'building',
  website_url text,
  domain text,
  domain_owner text, -- 'client' | 'signal_works' | free text
  registrar text,
  hosting_platform text,
  hosting_status public.hosting_status not null default 'none',
  ssl_status public.ssl_status not null default 'none',
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
  -- Stripe identifiers only (no card data)
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_status public.subscription_status not null default 'none',
  current_period_end timestamptz,
  -- Ops
  estimated_infra_cost_cents integer not null default 0,
  support_email text,
  support_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_status_idx on public.clients (status);
create index clients_stripe_customer_idx on public.clients (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Client members (who can log in for a client)
-- ---------------------------------------------------------------------------
create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, profile_id)
);

create index client_members_profile_idx on public.client_members (profile_id);

-- ---------------------------------------------------------------------------
-- Service requests
-- ---------------------------------------------------------------------------
create type public.request_type as enum (
  'text_change',
  'new_photo',
  'hours_update',
  'new_service',
  'scheduling_update',
  'new_page_or_feature',
  'other'
);

create type public.request_status as enum (
  'submitted',
  'in_progress',
  'waiting_on_client',
  'completed',
  'canceled'
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  request_type public.request_type not null default 'other',
  title text not null,
  description text not null,
  status public.request_status not null default 'submitted',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index service_requests_client_idx on public.service_requests (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  );
$$;

create or replace function public.is_client_member(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_members m
    where m.client_id = p_client_id and m.profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.service_requests enable row level security;
alter table public.documents enable row level security;

-- Profiles
create policy "Users read own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "Users update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins manage profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Clients
create policy "Members read own clients"
  on public.clients for select
  using (public.is_client_member(id) or public.is_admin());

create policy "Admins manage clients"
  on public.clients for all
  using (public.is_admin())
  with check (public.is_admin());

-- Client members
create policy "Members see membership"
  on public.client_members for select
  using (profile_id = auth.uid() or public.is_admin());

create policy "Admins manage membership"
  on public.client_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- Service requests
create policy "Members read requests"
  on public.service_requests for select
  using (public.is_client_member(client_id) or public.is_admin());

create policy "Members create requests"
  on public.service_requests for insert
  with check (public.is_client_member(client_id) or public.is_admin());

create policy "Admins update requests"
  on public.service_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- Documents
create policy "Members read documents"
  on public.documents for select
  using (public.is_client_member(client_id) or public.is_admin());

create policy "Admins manage documents"
  on public.documents for all
  using (public.is_admin())
  with check (public.is_admin());
