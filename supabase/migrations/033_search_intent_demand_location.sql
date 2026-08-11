alter table public.search_intent_demand
  add column if not exists location_code integer,
  add column if not exists location_name text;

update public.search_intent_demand
set location_code = 2840,
    location_name = coalesce(location_name, 'United States')
where location_code is null;

alter table public.search_intent_demand
  drop constraint if exists search_intent_demand_normalized_intent_country_code_language_code_key;

alter table public.search_intent_demand
  alter column location_code set not null;

alter table public.search_intent_demand
  add constraint search_intent_demand_intent_location_key
  unique (normalized_intent, country_code, language_code, location_code);

create index if not exists search_intent_demand_location_lookup_idx
  on public.search_intent_demand (normalized_intent, country_code, language_code, location_code, checked_at);
