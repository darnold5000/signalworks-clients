-- Bundled catalog products are entitlements (item_type = product), not billable add-ons.
alter table public.client_offer_items
  drop constraint if exists client_offer_items_item_type_check;

alter table public.client_offer_items
  add constraint client_offer_items_item_type_check
  check (item_type in (
    'base_plan',
    'setup_fee',
    'add_on',
    'product',
    'custom_service',
    'credit',
    'discount'
  ));

-- Phase A stored bundled catalog products as $0 add_ons; relabel as product entitlements.
update public.client_offer_items
set
  item_type = 'product',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'commercial_role', 'bundled_product',
    'included_in_plan', true
  )
where item_type = 'add_on'
  and unit_amount_cents = 0
  and metadata ? 'product_key'
  and coalesce(metadata->>'commercial_role', '') = '';
