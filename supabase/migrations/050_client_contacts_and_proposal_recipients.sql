-- Separate client contacts from portal identities and track proposal delivery.
-- Additive and safe to rerun; legacy tenant_profile contact fields remain intact.

alter table public.tenant_contacts
  add column if not exists receives_proposals boolean not null default false,
  add column if not exists receives_billing boolean not null default false,
  add column if not exists receives_notifications boolean not null default false;

alter table public.tenant_profiles
  drop constraint if exists tenant_profiles_onboarding_status_check;
alter table public.tenant_profiles
  add constraint tenant_profiles_onboarding_status_check check (onboarding_status in (
    'not_started', 'invited', 'account_created',
    'company_information_confirmed', 'offer_viewed', 'terms_accepted',
    'checkout_started', 'payment_complete', 'onboarding_complete'
  ));

create or replace function public.normalize_tenant_contact_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists tenant_contacts_normalize_email on public.tenant_contacts;
create trigger tenant_contacts_normalize_email
  before insert or update of email on public.tenant_contacts
  for each row execute function public.normalize_tenant_contact_email();

update public.tenant_contacts
set
  email = nullif(lower(btrim(email)), ''),
  receives_proposals = receives_proposals or is_primary,
  receives_billing = receives_billing or is_billing_contact,
  receives_notifications = receives_notifications or is_primary;

-- Preserve existing production client data by projecting legacy profile contacts
-- only when the same normalized email is not already represented.
insert into public.tenant_contacts (
  tenant_id, name, email, phone, contact_type, is_primary,
  receives_proposals, receives_notifications
)
select
  p.tenant_id,
  coalesce(nullif(btrim(p.primary_contact_name), ''), nullif(btrim(p.display_name), ''), lower(btrim(p.primary_contact_email))),
  lower(btrim(p.primary_contact_email)),
  nullif(btrim(p.primary_contact_phone), ''),
  'owner',
  not exists (
    select 1 from public.tenant_contacts existing_primary
    where existing_primary.tenant_id = p.tenant_id and existing_primary.is_primary
  ),
  true,
  true
from public.tenant_profiles p
where nullif(btrim(p.primary_contact_email), '') is not null
  and not exists (
    select 1 from public.tenant_contacts c
    where c.tenant_id = p.tenant_id
      and lower(btrim(c.email)) = lower(btrim(p.primary_contact_email))
  );

insert into public.tenant_contacts (
  tenant_id, name, email, contact_type, is_billing_contact, receives_billing
)
select
  p.tenant_id,
  coalesce(nullif(btrim(p.billing_contact_name), ''), lower(btrim(p.billing_contact_email))),
  lower(btrim(p.billing_contact_email)),
  'billing',
  true,
  true
from public.tenant_profiles p
where nullif(btrim(p.billing_contact_email), '') is not null
  and not exists (
    select 1 from public.tenant_contacts c
    where c.tenant_id = p.tenant_id
      and lower(btrim(c.email)) = lower(btrim(p.billing_contact_email))
  );

create unique index if not exists tenant_contacts_tenant_email_lower_uidx
  on public.tenant_contacts (tenant_id, lower(btrim(email)))
  where email is not null;

create table if not exists public.proposal_recipients (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.client_offers (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid references public.tenant_contacts (id) on delete set null,
  email text not null,
  name text,
  access_token_hash text not null unique,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed', 'link_ready')),
  sent_at timestamptz,
  last_error text,
  viewed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists proposal_recipients_offer_email_lower_uidx
  on public.proposal_recipients (offer_id, lower(btrim(email)));
create index if not exists proposal_recipients_offer_idx
  on public.proposal_recipients (offer_id, created_at);
create index if not exists proposal_recipients_tenant_idx
  on public.proposal_recipients (tenant_id, created_at desc);

drop trigger if exists proposal_recipients_set_updated_at on public.proposal_recipients;
create trigger proposal_recipients_set_updated_at
  before update on public.proposal_recipients
  for each row execute function public.set_updated_at();

alter table public.proposal_recipients enable row level security;

drop policy if exists proposal_recipients_admin_manage on public.proposal_recipients;
create policy proposal_recipients_admin_manage
  on public.proposal_recipients for all
  using (public.has_platform_permission('manage_client_offers'))
  with check (public.has_platform_permission('manage_client_offers'));

grant select, insert, update, delete on table public.proposal_recipients to authenticated;
grant select, insert, update, delete on table public.proposal_recipients to service_role;
