-- Development-only seed for client_pipeline.
-- Run manually in a dev environment after 008_client_pipeline_tenant_aware.sql.

insert into public.client_pipeline (
  tenant_id,
  business_name,
  contact_name,
  status,
  plan
)
select
  t.id,
  v.business_name,
  v.contact_name,
  v.status,
  v.plan
from (
  values
    ('MA5', 'TBD', 'potential', null::text),
    ('DAWG', 'TBD', 'potential', null),
    ('Zero Limits', 'TBD', 'potential', null),
    ('Market Street', 'TBD', 'potential', null),
    ('Oak Tree Golf', 'TBD', 'potential', null),
    ('Shay''s House of Dolls', 'TBD', 'potential', null),
    ('Cornerstone', 'TBD', 'potential', null)
) as v(business_name, contact_name, status, plan)
cross join public.tenants t
where t.slug = 'signalworks'
  and t.platform_category = 'internal'
  and t.status = 'active';
