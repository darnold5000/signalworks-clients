-- Unknown commercial configuration must remain distinct from an established $0 plan.
-- Existing values are preserved; this only permits new client-first rows to use null.

alter table public.tenant_portal_settings
  alter column plan_name drop not null,
  alter column plan_name drop default,
  alter column monthly_price_cents drop not null,
  alter column monthly_price_cents drop default;

