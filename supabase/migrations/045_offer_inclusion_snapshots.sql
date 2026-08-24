-- Keep proposal inclusions offer-owned. Tenant portal settings are mutable account
-- defaults and must never leak into a new draft or add-on proposal.
alter table public.client_offers
  add column if not exists plan_inclusions text[] null,
  add column if not exists setup_inclusions text[] null;

comment on column public.client_offers.plan_inclusions is
  'Historical plan inclusions explicitly stored for this offer; never inherited at render time.';
comment on column public.client_offers.setup_inclusions is
  'Historical setup inclusions explicitly stored for this offer; never inherited at render time.';

-- Before offer-owned snapshots existed, purchased/accepted proposals rendered the
-- tenant portal settings. Preserve that last known historical presentation once,
-- without applying it to drafts or newly published offers.
update public.client_offers as offer
set
  plan_inclusions = coalesce(
    settings.plan_inclusions,
    array[
      'Website',
      'Hosting',
      'Database',
      'Website Security',
      'Platform Updates',
      'Basic SEO',
      'Maintenance & Monitoring'
    ]::text[]
  ),
  setup_inclusions = coalesce(
    settings.setup_inclusions,
    array['Domain Transfer', 'Business Email Setup']::text[]
  )
from public.tenant_portal_settings as settings
where offer.tenant_id = settings.tenant_id
  and offer.status in ('accepted', 'purchased')
  and offer.plan_inclusions is null
  and offer.setup_inclusions is null;

-- Tenants without a portal-settings row previously received these same defaults
-- from the application mapper. Snapshot them only for historical purchases.
update public.client_offers
set
  plan_inclusions = array[
    'Website',
    'Hosting',
    'Database',
    'Website Security',
    'Platform Updates',
    'Basic SEO',
    'Maintenance & Monitoring'
  ]::text[],
  setup_inclusions = array['Domain Transfer', 'Business Email Setup']::text[]
where status in ('accepted', 'purchased')
  and plan_inclusions is null
  and setup_inclusions is null;
