-- Client-facing proposal copy that is independent of Stripe billing metadata.
alter table public.client_offers
  add column if not exists short_summary text;

create table if not exists public.client_offer_features (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.client_offers (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_offer_features_offer_idx
  on public.client_offer_features (offer_id, sort_order, created_at);

create or replace function public.enforce_client_offer_feature_tenant_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.client_offers o
    where o.id = new.offer_id and o.tenant_id = new.tenant_id
  ) then
    raise exception 'Offer feature tenant must match its offer tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists client_offer_features_enforce_tenant
  on public.client_offer_features;
create trigger client_offer_features_enforce_tenant
  before insert or update of offer_id, tenant_id
  on public.client_offer_features
  for each row execute function public.enforce_client_offer_feature_tenant_match();

alter table public.client_offer_features enable row level security;

drop policy if exists client_offer_features_select
  on public.client_offer_features;
create policy client_offer_features_select
  on public.client_offer_features for select
  to authenticated
  using (
    exists (
      select 1 from public.client_offers o
      where o.id = offer_id
        and (
          public.has_platform_permission('manage_tenants')
          or public.has_platform_permission('manage_client_offers')
          or (
            public.is_tenant_member(o.tenant_id)
            and public.client_offer_visible_to_member(o.status)
          )
        )
    )
  );

drop policy if exists client_offer_features_manage
  on public.client_offer_features;
create policy client_offer_features_manage
  on public.client_offer_features for all
  to authenticated
  using (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  )
  with check (
    public.has_platform_permission('manage_tenants')
    or public.has_platform_permission('manage_client_offers')
  );

grant select, insert, update, delete on table public.client_offer_features
  to authenticated, service_role;
grant execute on function public.enforce_client_offer_feature_tenant_match()
  to authenticated, service_role;
