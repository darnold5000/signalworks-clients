-- Platform plan and product catalogs for offer-first Invite Client flow.
-- Requires 003_client_management_phase1.sql (client_offers / client_offer_items).

-- ---------------------------------------------------------------------------
-- platform_plan_templates
-- ---------------------------------------------------------------------------

create table if not exists public.platform_plan_templates (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  description text,
  default_price_cents integer not null check (default_price_cents >= 0),
  billing_interval text not null default 'month'
    check (billing_interval in ('day', 'week', 'month', 'year')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_plan_templates_active_sort_idx
  on public.platform_plan_templates (is_active, sort_order, name);

drop trigger if exists platform_plan_templates_set_updated_at on public.platform_plan_templates;
create trigger platform_plan_templates_set_updated_at
  before update on public.platform_plan_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- platform_product_catalog
-- ---------------------------------------------------------------------------

create table if not exists public.platform_product_catalog (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  name text not null,
  description text,
  category text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_product_catalog_active_sort_idx
  on public.platform_product_catalog (is_active, sort_order, name);

drop trigger if exists platform_product_catalog_set_updated_at on public.platform_product_catalog;
create trigger platform_product_catalog_set_updated_at
  before update on public.platform_product_catalog
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Offer item metadata (stable plan_key / product_key for reporting)
-- ---------------------------------------------------------------------------

alter table public.client_offer_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Seeds — plan templates
-- ---------------------------------------------------------------------------

insert into public.platform_plan_templates (
  plan_key, name, description, default_price_cents, billing_interval, sort_order
) values
  (
    'brand',
    'Brand',
    'Marketing website only.',
    4900,
    'month',
    10
  ),
  (
    'launch',
    'Launch',
    'Website plus light business tools.',
    14900,
    'month',
    20
  ),
  (
    'platform',
    'Platform',
    'Full business platform and SaaS capabilities.',
    39900,
    'month',
    30
  ),
  (
    'custom',
    'Custom',
    'Unique scope — enter the agreed monthly amount.',
    0,
    'month',
    40
  )
on conflict (plan_key) do update set
  name = excluded.name,
  description = excluded.description,
  default_price_cents = excluded.default_price_cents,
  billing_interval = excluded.billing_interval,
  sort_order = excluded.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Seeds — product catalog
-- ---------------------------------------------------------------------------

insert into public.platform_product_catalog (
  product_key, name, category, sort_order
) values
  ('website', 'Website', 'core', 10),
  ('hosting', 'Hosting', 'infrastructure', 20),
  ('domain_management', 'Domain Management', 'infrastructure', 30),
  ('client_portal', 'Client Portal', 'platform', 40),
  ('online_booking', 'Online Booking', 'operations', 50),
  ('scheduling', 'Scheduling', 'operations', 60),
  ('stripe_payments', 'Stripe Payments', 'payments', 70),
  ('customer_crm', 'Customer CRM', 'platform', 80),
  ('memberships', 'Memberships', 'platform', 90),
  ('staff_portal', 'Staff Portal', 'platform', 100),
  ('email_marketing', 'Email Marketing', 'marketing', 110),
  ('email_setup', 'Email Setup', 'infrastructure', 120),
  ('seo', 'SEO', 'marketing', 130),
  ('analytics', 'Analytics', 'marketing', 140),
  ('reviews', 'Reviews', 'marketing', 150),
  ('blog', 'Blog', 'marketing', 160),
  ('forms', 'Forms', 'platform', 170),
  ('sms_notifications', 'SMS Notifications', 'communications', 180),
  ('reporting', 'Reporting', 'platform', 190),
  ('inventory', 'Inventory', 'operations', 200),
  ('pos', 'POS', 'operations', 210),
  ('ai_chatbot', 'AI Chatbot', 'platform', 220),
  ('mobile_app', 'Mobile App', 'platform', 230),
  ('custom_integration', 'Custom Integration', 'custom', 240),
  ('other', 'Other', 'custom', 250)
on conflict (product_key) do update set
  name = excluded.name,
  category = excluded.category,
  sort_order = excluded.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.platform_plan_templates enable row level security;
alter table public.platform_product_catalog enable row level security;

drop policy if exists platform_plan_templates_select on public.platform_plan_templates;
create policy platform_plan_templates_select
  on public.platform_plan_templates for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

drop policy if exists platform_plan_templates_manage on public.platform_plan_templates;
create policy platform_plan_templates_manage
  on public.platform_plan_templates for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

drop policy if exists platform_product_catalog_select on public.platform_product_catalog;
create policy platform_product_catalog_select
  on public.platform_product_catalog for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

drop policy if exists platform_product_catalog_manage on public.platform_product_catalog;
create policy platform_product_catalog_manage
  on public.platform_product_catalog for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

grant select, insert, update, delete on table public.platform_plan_templates
  to authenticated, service_role;
grant select, insert, update, delete on table public.platform_product_catalog
  to authenticated, service_role;
