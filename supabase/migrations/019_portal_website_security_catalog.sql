-- Portal website security fields + Managed Email Delivery catalog price.

alter table public.tenant_portal_settings
  add column if not exists website_security_status text
    check (
      website_security_status is null
      or website_security_status in (
        'protected',
        'needs_attention',
        'issue_detected'
      )
    ),
  add column if not exists website_security_https_enabled boolean,
  add column if not exists website_security_cert_valid boolean,
  add column if not exists website_security_cert_expires_at timestamptz,
  add column if not exists website_last_updated_at timestamptz;

update public.tenant_portal_settings
set website_security_status = case ssl_status
  when 'active' then 'protected'
  when 'pending' then 'needs_attention'
  when 'error' then 'issue_detected'
  else 'needs_attention'
end
where website_security_status is null;

update public.platform_product_catalog
set
  name = 'Managed Email Delivery',
  default_add_on_price_cents = 1000,
  suggested_add_on_price_cents = 1000,
  updated_at = now()
where product_key = 'business_email_setup';
