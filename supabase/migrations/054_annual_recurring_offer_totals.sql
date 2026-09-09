-- Keep the legacy recurring_total_cents aggregate as monthly recurring/MRR.
-- Annual charges remain full annual amounts and are never amortized for billing.
alter table public.client_offers
  add column if not exists annual_recurring_total_cents integer not null default 0
    check (annual_recurring_total_cents >= 0);

alter table public.purchases
  add column if not exists annual_recurring_total_cents integer not null default 0
    check (annual_recurring_total_cents >= 0);

-- Mixed-cadence Checkout remains one purchase, with durable progress and one
-- hosted Checkout Session reference per cadence for safe resume/retry.
alter table public.purchases
  add column if not exists checkout_state text not null default 'pending'
    check (checkout_state in (
      'pending',
      'monthly_complete',
      'annual_complete',
      'complete',
      'failed',
      'canceled'
    )),
  add column if not exists monthly_checkout_session_id text,
  add column if not exists annual_checkout_session_id text;

-- Adding a NOT NULL column with DEFAULT 0 backfills existing PostgreSQL rows.
-- Keep an explicit update for compatibility with partially applied previews.
update public.client_offers
set annual_recurring_total_cents = 0
where annual_recurring_total_cents is null;

update public.purchases
set annual_recurring_total_cents = 0
where annual_recurring_total_cents is null;

update public.purchases
set checkout_state = case
  when status in ('active', 'paid', 'refunded') then 'complete'
  when status = 'canceled' then 'canceled'
  when status = 'failed' then 'failed'
  else 'pending'
end
where checkout_state = 'pending';

create unique index if not exists purchases_monthly_checkout_session_idx
  on public.purchases (monthly_checkout_session_id)
  where monthly_checkout_session_id is not null;

create unique index if not exists purchases_annual_checkout_session_idx
  on public.purchases (annual_checkout_session_id)
  where annual_checkout_session_id is not null;

comment on column public.client_offers.recurring_total_cents is
  'Monthly recurring total (MRR). Annual recurring charges are excluded.';
comment on column public.client_offers.annual_recurring_total_cents is
  'Annual recurring total billed on its annual cadence.';
comment on column public.purchases.recurring_total_cents is
  'Monthly recurring total (MRR). Annual recurring charges are excluded.';
comment on column public.purchases.annual_recurring_total_cents is
  'Annual recurring total billed on its annual cadence.';
comment on column public.purchases.checkout_state is
  'Durable progress through the hosted Checkout stages for this purchase.';
