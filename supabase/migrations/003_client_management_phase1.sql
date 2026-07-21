-- Phase 1: client management, offers, agreements, purchases, activity (schema + RLS).
-- Requires:
--   signalworks-platform/core/001_platform_foundation.sql
--   signalworks-platform/core/004_client_management_permissions.sql
--   signalworks-clients/001_client_portal.sql

-- ---------------------------------------------------------------------------
-- tenant_profiles — business / CRM profile (distinct from tenant_portal_settings)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  legal_business_name text,
  display_name text,
  business_type text,

  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,

  billing_contact_name text,
  billing_contact_email text,

  website_url text,
  primary_domain text,
  support_email text,

  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',

  logo_url text,
  internal_status text not null default 'prospect'
    check (internal_status in (
      'prospect',
      'invited',
      'onboarding',
      'awaiting_agreement',
      'awaiting_payment',
      'active',
      'past_due',
      'paused',
      'canceled',
      'archived'
    )),
  onboarding_status text not null default 'invited'
    check (onboarding_status in (
      'invited',
      'account_created',
      'company_information_confirmed',
      'offer_viewed',
      'terms_accepted',
      'checkout_started',
      'payment_complete',
      'onboarding_complete'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_profiles_internal_status_idx
  on public.tenant_profiles (internal_status);

create index if not exists tenant_profiles_onboarding_status_idx
  on public.tenant_profiles (onboarding_status);

create index if not exists tenant_profiles_primary_contact_email_idx
  on public.tenant_profiles (lower(primary_contact_email))
  where primary_contact_email is not null;

-- ---------------------------------------------------------------------------
-- tenant_technical_profiles — internal ops metadata (no secrets)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_technical_profiles (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,

  architecture_type text,
  repository_provider text,
  repository_owner text,
  repository_name text,
  repository_url text,
  default_branch text,

  hosting_provider text,
  hosting_project_name text,
  hosting_project_id text,
  production_url text,

  domain_registrar text,
  dns_provider text,
  primary_domain text,

  database_provider text,
  database_project_name text,
  database_project_reference text,
  database_region text,
  database_schema_name text,

  storage_provider text,
  storage_bucket_names text[],

  stripe_account_type text,
  stripe_connected_account_id text,

  email_provider text,
  email_sending_domain text,

  analytics_provider text,
  analytics_property_id text,

  source_code_ownership text,
  backup_policy text,
  last_backup_verified_at timestamptz,

  deployment_notes text,
  technical_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tenant_contacts
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  job_title text,

  contact_type text not null default 'other'
    check (contact_type in (
      'owner', 'billing', 'technical', 'marketing', 'operations', 'other'
    )),
  is_primary boolean not null default false,
  is_billing_contact boolean not null default false,
  is_technical_contact boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_contacts_tenant_idx
  on public.tenant_contacts (tenant_id, created_at desc);

create unique index if not exists tenant_contacts_one_primary_per_tenant_idx
  on public.tenant_contacts (tenant_id)
  where is_primary = true;

-- ---------------------------------------------------------------------------
-- tenant_internal_notes — admin-only notes (not exposed to tenant members)
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_internal_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  subject_type text not null
    check (subject_type in ('profile', 'contact', 'general')),
  subject_id uuid,

  body text not null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_internal_notes_tenant_idx
  on public.tenant_internal_notes (tenant_id, created_at desc);

create index if not exists tenant_internal_notes_subject_idx
  on public.tenant_internal_notes (tenant_id, subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- legal_documents — versioned; tenant_id null = platform-wide
-- ---------------------------------------------------------------------------

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid references public.tenants (id) on delete cascade,

  document_type text not null
    check (document_type in (
      'terms_of_service',
      'service_agreement',
      'privacy_policy',
      'acceptable_use_policy',
      'custom_addendum'
    )),
  title text not null,
  version text not null,

  content_html text not null,
  content_text text,

  effective_date date,
  active boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint legal_documents_custom_addendum_requires_tenant check (
    document_type <> 'custom_addendum' or tenant_id is not null
  ),
  constraint legal_documents_platform_types_require_global_tenant check (
    document_type = 'custom_addendum'
    or tenant_id is null
  )
);

create unique index if not exists legal_documents_global_version_uidx
  on public.legal_documents (document_type, version)
  where tenant_id is null;

create unique index if not exists legal_documents_tenant_version_uidx
  on public.legal_documents (tenant_id, document_type, version)
  where tenant_id is not null;

create index if not exists legal_documents_tenant_active_idx
  on public.legal_documents (tenant_id, active, effective_date desc)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- client_offers
-- ---------------------------------------------------------------------------

create table if not exists public.client_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  title text not null,
  description text,

  status text not null default 'draft'
    check (status in (
      'draft',
      'published',
      'viewed',
      'accepted',
      'checkout_started',
      'purchased',
      'expired',
      'canceled'
    )),

  currency text not null default 'usd',

  valid_from timestamptz,
  expires_at timestamptz,

  terms_document_id uuid references public.legal_documents (id) on delete set null,
  requires_terms_acceptance boolean not null default true,

  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_total_cents integer not null default 0 check (discount_total_cents >= 0),
  initial_total_cents integer not null default 0 check (initial_total_cents >= 0),
  recurring_total_cents integer not null default 0 check (recurring_total_cents >= 0),

  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  accepted_at timestamptz,
  purchased_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_offers_tenant_status_idx
  on public.client_offers (tenant_id, status, created_at desc);

create index if not exists client_offers_expires_at_idx
  on public.client_offers (expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------------
-- client_offer_items
-- ---------------------------------------------------------------------------

create table if not exists public.client_offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.client_offers (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  item_type text not null
    check (item_type in (
      'base_plan', 'setup_fee', 'add_on', 'custom_service', 'credit', 'discount'
    )),
  name text not null,
  description text,

  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),

  billing_type text not null
    check (billing_type in ('one_time', 'recurring')),
  billing_interval text
    check (billing_interval is null or billing_interval in ('day', 'week', 'month', 'year')),
  billing_interval_count integer not null default 1 check (billing_interval_count > 0),

  discount_type text
    check (discount_type is null or discount_type in ('amount', 'percent')),
  discount_amount_cents integer check (discount_amount_cents is null or discount_amount_cents >= 0),
  discount_percent numeric(5, 2)
    check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  discount_duration_type text
    check (discount_duration_type is null or discount_duration_type in ('once', 'repeating', 'forever')),
  discount_duration_months integer check (discount_duration_months is null or discount_duration_months > 0),

  stripe_product_id text,
  stripe_price_id text,
  stripe_coupon_id text,

  is_optional boolean not null default false,
  is_selected boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_offer_items_offer_idx
  on public.client_offer_items (offer_id, sort_order);

create index if not exists client_offer_items_tenant_idx
  on public.client_offer_items (tenant_id);

-- ---------------------------------------------------------------------------
-- purchases — immutable purchase snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants (id) on delete cascade,
  offer_id uuid references public.client_offers (id) on delete set null,

  status text not null default 'pending'
    check (status in (
      'pending',
      'checkout_created',
      'active',
      'paid',
      'past_due',
      'canceled',
      'refunded',
      'failed'
    )),

  currency text not null default 'usd',

  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_total_cents integer not null default 0 check (discount_total_cents >= 0),
  amount_due_today_cents integer not null default 0 check (amount_due_today_cents >= 0),
  recurring_total_cents integer not null default 0 check (recurring_total_cents >= 0),

  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,

  purchased_by uuid references public.profiles (id) on delete set null,
  purchased_at timestamptz,

  purchase_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchases_tenant_status_idx
  on public.purchases (tenant_id, status, created_at desc);

create unique index if not exists purchases_stripe_checkout_session_idx
  on public.purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists purchases_stripe_subscription_idx
  on public.purchases (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- purchase_items
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),

  purchase_id uuid not null references public.purchases (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  source_offer_item_id uuid references public.client_offer_items (id) on delete set null,

  name text not null,
  description text,

  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),

  billing_type text not null
    check (billing_type in ('one_time', 'recurring')),
  billing_interval text
    check (billing_interval is null or billing_interval in ('day', 'week', 'month', 'year')),

  discount_summary text,

  stripe_product_id text,
  stripe_price_id text,

  service_status text not null default 'pending'
    check (service_status in (
      'pending', 'active', 'paused', 'canceled', 'completed', 'failed'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_items_purchase_idx
  on public.purchase_items (purchase_id);

create index if not exists purchase_items_tenant_idx
  on public.purchase_items (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- agreement_acceptances
-- ---------------------------------------------------------------------------

create table if not exists public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  offer_id uuid references public.client_offers (id) on delete set null,
  legal_document_id uuid not null references public.legal_documents (id) on delete restrict,

  document_version text not null,
  accepted_name text not null,
  accepted_email text not null,

  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,

  document_snapshot_html text not null,
  document_hash text not null,

  created_at timestamptz not null default now()
);

create index if not exists agreement_acceptances_tenant_idx
  on public.agreement_acceptances (tenant_id, accepted_at desc);

create index if not exists agreement_acceptances_offer_idx
  on public.agreement_acceptances (offer_id)
  where offer_id is not null;

create index if not exists agreement_acceptances_user_idx
  on public.agreement_acceptances (user_id, accepted_at desc);

-- ---------------------------------------------------------------------------
-- tenant_activity_log
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_activity_log (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants (id) on delete cascade,

  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type text not null default 'user'
    check (actor_type in ('user', 'admin', 'system', 'stripe_webhook')),

  action text not null,
  entity_type text,
  entity_id uuid,

  summary text not null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists tenant_activity_log_tenant_created_idx
  on public.tenant_activity_log (tenant_id, created_at desc);

create index if not exists tenant_activity_log_action_idx
  on public.tenant_activity_log (tenant_id, action, created_at desc);

-- ---------------------------------------------------------------------------
-- stripe_webhook_events — idempotent webhook processing (service role writes)
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null,
  processed boolean not null default false,
  processing_error text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists stripe_webhook_events_processed_idx
  on public.stripe_webhook_events (processed, received_at desc);

-- ---------------------------------------------------------------------------
-- Extend tenant_subscriptions for multiple subscriptions per tenant
-- (existing table from 001_client_portal.sql — additive only)
-- ---------------------------------------------------------------------------

do $$
declare
  v_constraint name;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tenant_subscriptions'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~ '\mtenant_id\M'
  loop
    execute format(
      'alter table public.tenant_subscriptions drop constraint %I',
      v_constraint
    );
  end loop;

  if exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (i.indkey)
    where n.nspname = 'public'
      and t.relname = 'tenant_subscriptions'
      and a.attname = 'tenant_id'
      and i.indisunique
      and i.indnatts = 1
      and not i.indisprimary
  ) then
    raise exception
      'tenant_subscriptions.tenant_id is still unique — migration aborted';
  end if;
end $$;

alter table public.tenant_subscriptions
  add column if not exists purchase_id uuid references public.purchases (id) on delete set null,
  add column if not exists current_period_start timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists standard_amount_cents integer
    check (standard_amount_cents is null or standard_amount_cents >= 0),
  add column if not exists current_discount_amount_cents integer
    check (current_discount_amount_cents is null or current_discount_amount_cents >= 0),
  add column if not exists current_effective_amount_cents integer
    check (current_effective_amount_cents is null or current_effective_amount_cents >= 0),
  add column if not exists discount_ends_at timestamptz;

-- stripe_subscription_id must stay unique for webhook idempotency (001 allows nulls).
create unique index if not exists tenant_subscriptions_stripe_subscription_id_uidx
  on public.tenant_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'tenant_subscriptions'
      and indexname = 'tenant_subscriptions_stripe_subscription_id_uidx'
  ) then
    raise exception
      'tenant_subscriptions.stripe_subscription_id unique index missing — migration aborted';
  end if;
end $$;

create index if not exists tenant_subscriptions_tenant_status_idx
  on public.tenant_subscriptions (tenant_id, subscription_status);

create index if not exists tenant_subscriptions_purchase_idx
  on public.tenant_subscriptions (purchase_id)
  where purchase_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists tenant_profiles_set_updated_at on public.tenant_profiles;
create trigger tenant_profiles_set_updated_at
  before update on public.tenant_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_technical_profiles_set_updated_at on public.tenant_technical_profiles;
create trigger tenant_technical_profiles_set_updated_at
  before update on public.tenant_technical_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_contacts_set_updated_at on public.tenant_contacts;
create trigger tenant_contacts_set_updated_at
  before update on public.tenant_contacts
  for each row execute function public.set_updated_at();

drop trigger if exists client_offers_set_updated_at on public.client_offers;
create trigger client_offers_set_updated_at
  before update on public.client_offers
  for each row execute function public.set_updated_at();

drop trigger if exists client_offer_items_set_updated_at on public.client_offer_items;
create trigger client_offer_items_set_updated_at
  before update on public.client_offer_items
  for each row execute function public.set_updated_at();

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

drop trigger if exists purchase_items_set_updated_at on public.purchase_items;
create trigger purchase_items_set_updated_at
  before update on public.purchase_items
  for each row execute function public.set_updated_at();

drop trigger if exists tenant_internal_notes_set_updated_at on public.tenant_internal_notes;
create trigger tenant_internal_notes_set_updated_at
  before update on public.tenant_internal_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard denormalized tenant_id on child rows
-- ---------------------------------------------------------------------------

create or replace function public.enforce_client_offer_item_tenant_match()
returns trigger
language plpgsql
as $$
declare
  v_offer_tenant_id uuid;
begin
  select o.tenant_id
  into v_offer_tenant_id
  from public.client_offers o
  where o.id = new.offer_id;

  if v_offer_tenant_id is null then
    raise exception 'client_offer_items.offer_id % not found', new.offer_id;
  end if;

  if new.tenant_id is distinct from v_offer_tenant_id then
    raise exception
      'client_offer_items.tenant_id must match parent offer (expected %, got %)',
      v_offer_tenant_id,
      new.tenant_id;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_purchase_item_tenant_match()
returns trigger
language plpgsql
as $$
declare
  v_purchase_tenant_id uuid;
begin
  select p.tenant_id
  into v_purchase_tenant_id
  from public.purchases p
  where p.id = new.purchase_id;

  if v_purchase_tenant_id is null then
    raise exception 'purchase_items.purchase_id % not found', new.purchase_id;
  end if;

  if new.tenant_id is distinct from v_purchase_tenant_id then
    raise exception
      'purchase_items.tenant_id must match parent purchase (expected %, got %)',
      v_purchase_tenant_id,
      new.tenant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists client_offer_items_enforce_tenant on public.client_offer_items;
create trigger client_offer_items_enforce_tenant
  before insert or update of offer_id, tenant_id
  on public.client_offer_items
  for each row execute function public.enforce_client_offer_item_tenant_match();

drop trigger if exists purchase_items_enforce_tenant on public.purchase_items;
create trigger purchase_items_enforce_tenant
  before insert or update of purchase_id, tenant_id
  on public.purchase_items
  for each row execute function public.enforce_purchase_item_tenant_match();

grant execute on function public.enforce_client_offer_item_tenant_match() to authenticated, service_role;
grant execute on function public.enforce_purchase_item_tenant_match() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS helpers (local to this migration)
-- ---------------------------------------------------------------------------

create or replace function public.client_offer_visible_to_member(offer_status text)
returns boolean
language sql
immutable
as $$
  select offer_status in (
    'published',
    'viewed',
    'accepted',
    'checkout_started',
    'purchased',
    'expired'
  );
$$;

grant execute on function public.client_offer_visible_to_member(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.tenant_profiles enable row level security;
alter table public.tenant_technical_profiles enable row level security;
alter table public.tenant_contacts enable row level security;
alter table public.tenant_internal_notes enable row level security;
alter table public.legal_documents enable row level security;
alter table public.client_offers enable row level security;
alter table public.client_offer_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.agreement_acceptances enable row level security;
alter table public.tenant_activity_log enable row level security;
alter table public.stripe_webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- tenant_profiles
-- ---------------------------------------------------------------------------

drop policy if exists tenant_profiles_select on public.tenant_profiles;
create policy tenant_profiles_select
  on public.tenant_profiles for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('view_all_tenants')
  );

drop policy if exists tenant_profiles_manage on public.tenant_profiles;
create policy tenant_profiles_manage
  on public.tenant_profiles for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );

-- ---------------------------------------------------------------------------
-- tenant_technical_profiles — platform staff only
-- ---------------------------------------------------------------------------

drop policy if exists tenant_technical_profiles_select on public.tenant_technical_profiles;
create policy tenant_technical_profiles_select
  on public.tenant_technical_profiles for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_technical_details')
  );

drop policy if exists tenant_technical_profiles_manage on public.tenant_technical_profiles;
create policy tenant_technical_profiles_manage
  on public.tenant_technical_profiles for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_technical_details')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_technical_details')
  );

-- ---------------------------------------------------------------------------
-- tenant_contacts
-- ---------------------------------------------------------------------------

drop policy if exists tenant_contacts_select on public.tenant_contacts;
create policy tenant_contacts_select
  on public.tenant_contacts for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('view_all_tenants')
    or public.has_platform_permission('manage_memberships')
  );

drop policy if exists tenant_contacts_manage on public.tenant_contacts;
create policy tenant_contacts_manage
  on public.tenant_contacts for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );

-- ---------------------------------------------------------------------------
-- tenant_internal_notes — platform staff only
-- ---------------------------------------------------------------------------

drop policy if exists tenant_internal_notes_select on public.tenant_internal_notes;
create policy tenant_internal_notes_select
  on public.tenant_internal_notes for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('view_all_tenants')
    or public.has_platform_permission('manage_memberships')
  );

drop policy if exists tenant_internal_notes_manage on public.tenant_internal_notes;
create policy tenant_internal_notes_manage
  on public.tenant_internal_notes for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_memberships')
  );

-- ---------------------------------------------------------------------------
-- legal_documents
-- ---------------------------------------------------------------------------

drop policy if exists legal_documents_select on public.legal_documents;
create policy legal_documents_select
  on public.legal_documents for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_agreements')
    or (
      active = true
      and (
        tenant_id is null
        or public.is_tenant_member(tenant_id)
      )
    )
  );

drop policy if exists legal_documents_manage on public.legal_documents;
create policy legal_documents_manage
  on public.legal_documents for insert
  to authenticated
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_agreements')
  );

drop policy if exists legal_documents_update on public.legal_documents;
create policy legal_documents_update
  on public.legal_documents for update
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_agreements')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_agreements')
  );

-- ---------------------------------------------------------------------------
-- client_offers
-- ---------------------------------------------------------------------------

drop policy if exists client_offers_select on public.client_offers;
create policy client_offers_select
  on public.client_offers for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
    or (
      public.is_tenant_member(tenant_id)
      and public.client_offer_visible_to_member(status)
    )
  );

drop policy if exists client_offers_manage on public.client_offers;
create policy client_offers_manage
  on public.client_offers for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

-- ---------------------------------------------------------------------------
-- client_offer_items
-- ---------------------------------------------------------------------------

drop policy if exists client_offer_items_select on public.client_offer_items;
create policy client_offer_items_select
  on public.client_offer_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_offers o
      where o.id = offer_id
        and (
          public.has_platform_permission('manage_tenants')
          or public.has_platform_permission('manage_client_offers')
          or (
            public.is_tenant_member(o.tenant_id)
            and public.client_offer_visible_to_member(o.status)
          )
        )
    )
  );

drop policy if exists client_offer_items_manage on public.client_offer_items;
create policy client_offer_items_manage
  on public.client_offer_items for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

-- ---------------------------------------------------------------------------
-- purchases — tenant read; platform billing staff read; writes via service role
-- ---------------------------------------------------------------------------

drop policy if exists purchases_select on public.purchases;
create policy purchases_select
  on public.purchases for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_billing')
    or public.has_platform_permission('manage_billing')
  );

-- ---------------------------------------------------------------------------
-- purchase_items
-- ---------------------------------------------------------------------------

drop policy if exists purchase_items_select on public.purchase_items;
create policy purchase_items_select
  on public.purchase_items for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_billing')
    or public.has_platform_permission('manage_billing')
  );

-- ---------------------------------------------------------------------------
-- agreement_acceptances — tenant read; writes via service role only
-- ---------------------------------------------------------------------------

drop policy if exists agreement_acceptances_select on public.agreement_acceptances;
create policy agreement_acceptances_select
  on public.agreement_acceptances for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    or public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_agreements')
  );

-- ---------------------------------------------------------------------------
-- tenant_activity_log — platform admin only
-- ---------------------------------------------------------------------------

drop policy if exists tenant_activity_log_select on public.tenant_activity_log;
create policy tenant_activity_log_select
  on public.tenant_activity_log for select
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('view_all_tenants')
  );

-- Inserts are service-role only (no authenticated insert policy).

-- stripe_webhook_events: RLS on, no authenticated policies (service role only)
