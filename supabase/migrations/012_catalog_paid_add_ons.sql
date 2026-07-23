-- Paid add-on defaults for catalog-driven Phase B invite / offer flows.

alter table public.platform_product_catalog
  add column if not exists is_paid_add_on boolean not null default false,
  add column if not exists default_add_on_price_cents integer
    check (
      default_add_on_price_cents is null
      or default_add_on_price_cents >= 0
    );

update public.platform_product_catalog
set
  is_paid_add_on = true,
  default_add_on_price_cents = 2900
where product_key = 'sms_notifications';

update public.platform_product_catalog
set
  is_paid_add_on = true,
  default_add_on_price_cents = 4900
where product_key = 'ai_chatbot';
