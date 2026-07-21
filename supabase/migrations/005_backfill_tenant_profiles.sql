-- One-time backfill: tenant_profiles for existing service tenants.
-- Safe to re-run: only inserts rows where tenant_profiles is missing.
-- Requires: 003_client_management_phase1.sql

insert into public.tenant_profiles (
  tenant_id,
  legal_business_name,
  display_name,
  primary_contact_name,
  primary_contact_email,
  primary_contact_phone,
  website_url,
  primary_domain,
  support_email,
  internal_status,
  onboarding_status,
  created_at,
  updated_at
)
select
  t.id as tenant_id,
  t.display_name as legal_business_name,
  t.display_name as display_name,
  owner.full_name as primary_contact_name,
  coalesce(ps.support_email, owner.email) as primary_contact_email,
  ps.support_phone as primary_contact_phone,
  ps.website_url as website_url,
  ps.domain as primary_domain,
  ps.support_email as support_email,
  case
    when t.status = 'active'
      and coalesce(sub.subscription_status, 'none') in ('active', 'trialing')
      then 'active'
    when t.status = 'past_due'
      or coalesce(sub.subscription_status, 'none') = 'past_due'
      then 'past_due'
    when t.status = 'canceled' then 'canceled'
    when t.status = 'paused' then 'paused'
    when offer.offer_id is not null
      and offer.requires_terms
      and not coalesce(offer.terms_accepted, false)
      then 'awaiting_agreement'
    when offer.offer_id is not null
      and coalesce(sub.subscription_status, 'none') not in ('active', 'trialing')
      then 'awaiting_payment'
    when t.status = 'onboarding' then 'onboarding'
    else 'invited'
  end as internal_status,
  case
    when coalesce(sub.subscription_status, 'none') in ('active', 'trialing')
      then 'onboarding_complete'
    when purchase.purchase_id is not null then 'onboarding_complete'
    when offer.offer_status = 'checkout_started' then 'checkout_started'
    when coalesce(offer.terms_accepted, false) then 'terms_accepted'
    when offer.offer_status in ('viewed', 'accepted') then 'offer_viewed'
    when owner.user_id is not null then 'account_created'
    else 'invited'
  end as onboarding_status,
  t.created_at,
  greatest(
    t.updated_at,
    coalesce(ps.updated_at, t.updated_at),
    coalesce(sub.updated_at, t.updated_at)
  ) as updated_at
from public.tenants t
left join public.tenant_portal_settings ps
  on ps.tenant_id = t.id
left join lateral (
  select
    ts.subscription_status,
    ts.updated_at
  from public.tenant_subscriptions ts
  where ts.tenant_id = t.id
  order by
    case ts.subscription_status
      when 'active' then 1
      when 'trialing' then 2
      when 'past_due' then 3
      when 'incomplete' then 4
      when 'unpaid' then 5
      when 'canceled' then 6
      else 7
    end,
    ts.updated_at desc nulls last
  limit 1
) sub on true
left join lateral (
  select
    o.id as offer_id,
    o.status as offer_status,
    o.requires_terms_acceptance as requires_terms,
    exists (
      select 1
      from public.agreement_acceptances aa
      where aa.tenant_id = t.id
        and aa.offer_id = o.id
    ) as terms_accepted
  from public.client_offers o
  where o.tenant_id = t.id
    and o.status not in ('draft', 'canceled', 'expired', 'purchased')
  order by o.published_at desc nulls last, o.created_at desc
  limit 1
) offer on true
left join lateral (
  select p.id as purchase_id
  from public.purchases p
  where p.tenant_id = t.id
    and p.status in ('paid', 'active')
  order by p.purchased_at desc nulls last, p.created_at desc
  limit 1
) purchase on true
left join lateral (
  select
    tm.user_id,
    p.full_name,
    p.email
  from public.tenant_memberships tm
  join public.profiles p on p.id = tm.user_id
  join public.roles r on r.id = tm.role_id
  where tm.tenant_id = t.id
    and tm.status = 'active'
    and r.slug = 'tenant_owner'
    and r.tenant_id is null
  order by tm.created_at asc
  limit 1
) owner on true
where t.platform_category = 'services'
  and not exists (
    select 1
    from public.tenant_profiles tp
    where tp.tenant_id = t.id
  );
