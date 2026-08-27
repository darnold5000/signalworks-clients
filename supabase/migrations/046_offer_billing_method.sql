-- Proposal-level billing behavior. Existing offers retain Stripe Checkout behavior.
alter table public.client_offers
  add column if not exists billing_method text not null default 'stripe_checkout'
    check (billing_method in ('stripe_checkout', 'proposal_only')),
  add column if not exists accepted_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists acceptance_snapshot jsonb;

comment on column public.client_offers.billing_method is
  'Controls whether acceptance continues to Stripe Checkout or ends after proposal acceptance.';

create or replace function public.protect_client_offer_billing_method()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'draft'
     and new.billing_method is distinct from old.billing_method then
    raise exception 'client_offers.billing_method cannot change after publication';
  end if;

  if old.acceptance_snapshot is not null
     and new.acceptance_snapshot is distinct from old.acceptance_snapshot then
    raise exception 'client_offers.acceptance_snapshot is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists client_offers_protect_billing_method on public.client_offers;
create trigger client_offers_protect_billing_method
  before update of billing_method, acceptance_snapshot on public.client_offers
  for each row execute function public.protect_client_offer_billing_method();

