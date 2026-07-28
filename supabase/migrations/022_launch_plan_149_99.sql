-- Launch plan default: $149.99/mo on invite + catalog cards.

update public.platform_plan_templates
set
  default_price_cents = 14999,
  updated_at = now()
where plan_key = 'launch';
