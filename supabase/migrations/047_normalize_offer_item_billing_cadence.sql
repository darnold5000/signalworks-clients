-- Normalize legacy offer cadence data. Existing columns were introduced in phase 1.
-- This migration is additive/data-safe and does not touch Stripe objects.
update public.client_offer_items
set billing_interval = 'month', billing_interval_count = 1
where billing_type = 'recurring'
  and billing_interval is null;

update public.client_offer_items
set billing_interval = null, billing_interval_count = 1
where billing_type = 'one_time'
  and billing_interval is not null;
