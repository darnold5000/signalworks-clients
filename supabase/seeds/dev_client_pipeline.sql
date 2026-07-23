-- Development-only seed for client_pipeline.
-- Run manually in a dev environment after 008_client_pipeline_tenant_aware.sql
-- and 009_client_pipeline_contact_fields.sql.

insert into public.client_pipeline (
  tenant_id,
  business_name,
  contact_name,
  contact_email,
  phone,
  website_url,
  status,
  plan,
  estimated_monthly_value_cents,
  next_follow_up_date,
  tags
)
select
  t.id,
  v.business_name,
  v.contact_name,
  v.contact_email,
  v.phone,
  v.website_url,
  v.status,
  v.plan,
  v.estimated_monthly_value_cents,
  v.next_follow_up_date::date,
  v.tags
from (
  values
    ('MA5', 'TBD', null::text, null::text, null::text, 'potential', null::text, null::integer, null::text, array[]::text[]),
    ('DAWG', 'TBD', null, null, null, 'potential', null, null, null, array[]::text[]),
    ('Zero Limits', 'TBD', null, null, null, 'potential', null, null, null, array[]::text[]),
    ('Market Street', 'TBD', null, null, null, 'potential', null, null, null, array[]::text[]),
    ('Oak Tree Golf', 'TBD', null, null, null, 'potential', null, null, null, array['Golf']::text[]),
    ('Shay''s House of Dolls', 'TBD', null, null, null, 'potential', null, null, null, array[]::text[]),
    ('Cornerstone', 'TBD', null, null, null, 'potential', null, null, null, array['Financial']::text[])
) as v(
  business_name,
  contact_name,
  contact_email,
  phone,
  website_url,
  status,
  plan,
  estimated_monthly_value_cents,
  next_follow_up_date,
  tags
)
cross join public.tenants t
where t.slug = 'signalworks'
  and t.platform_category = 'internal'
  and t.status = 'active';
