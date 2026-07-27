-- Align invite-client plan catalog with Signal Works website tiers (Brand / Growth).

update public.platform_plan_templates
set
  default_price_cents = 2499,
  description =
    'Professional brand presence — one-page website with hosting and support.',
  sort_order = 10,
  updated_at = now()
where plan_key = 'brand';

insert into public.platform_plan_templates (
  plan_key,
  name,
  description,
  default_price_cents,
  billing_interval,
  sort_order
)
values (
  'growth',
  'Growth',
  'Lead-focused website with SEO, content, and ongoing growth support.',
  4999,
  'month',
  15
)
on conflict (plan_key) do update set
  name = excluded.name,
  description = excluded.description,
  default_price_cents = excluded.default_price_cents,
  billing_interval = excluded.billing_interval,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

update public.platform_plan_templates
set sort_order = 20, updated_at = now()
where plan_key = 'launch';

update public.platform_plan_templates
set sort_order = 30, updated_at = now()
where plan_key = 'platform';

update public.platform_plan_templates
set sort_order = 40, updated_at = now()
where plan_key = 'custom';
