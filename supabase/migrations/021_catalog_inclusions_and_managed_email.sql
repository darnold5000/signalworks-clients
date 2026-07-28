-- Split included Business Email Setup from paid Managed Email Delivery.
-- Included setup and plan inclusions are applied in app code; this migration
-- fixes catalog rows used for paid selection and naming.

insert into public.platform_product_catalog (
  product_key,
  name,
  category,
  category_group,
  sort_order,
  catalog_kind,
  is_paid_add_on,
  default_add_on_price_cents,
  suggested_add_on_price_cents,
  supports_quantity,
  is_active
) values
  (
    'managed_email_delivery',
    'Managed Email Delivery',
    'communication',
    'communication',
    15,
    'service_add_on',
    true,
    1000,
    1000,
    false,
    true
  ),
  (
    'domain_transfer',
    'Domain Transfer',
    'core',
    'one_time',
    10,
    'service_add_on',
    false,
    0,
    0,
    false,
    true
  )
on conflict (product_key) do update set
  name = excluded.name,
  category = excluded.category,
  category_group = excluded.category_group,
  sort_order = excluded.sort_order,
  catalog_kind = excluded.catalog_kind,
  is_paid_add_on = excluded.is_paid_add_on,
  default_add_on_price_cents = excluded.default_add_on_price_cents,
  suggested_add_on_price_cents = excluded.suggested_add_on_price_cents,
  is_active = excluded.is_active;

update public.platform_product_catalog
set
  name = 'Business Email Setup',
  is_paid_add_on = false,
  default_add_on_price_cents = null,
  suggested_add_on_price_cents = null,
  updated_at = now()
where product_key = 'business_email_setup';

-- One-time billable services (grouped under One-Time Services in admin UI).
update public.platform_product_catalog
set category_group = 'one_time'
where product_key in (
  'data_migration',
  'custom_development',
  'api_integration'
);
