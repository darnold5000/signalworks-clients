create table if not exists public.search_intent_demand (
  id uuid primary key default gen_random_uuid(),
  normalized_intent text not null,
  display_intent text not null,
  country_code text not null default 'US',
  language_code text not null default 'en',
  monthly_search_volume integer,
  demand_level text not null default 'unavailable' check (demand_level in ('high', 'moderate', 'low', 'very_low', 'unavailable')),
  competition numeric,
  competition_index numeric,
  cpc numeric,
  source text not null default 'dataforseo_google_ads',
  confidence text,
  checked_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_intent, country_code, language_code)
);
create index if not exists search_intent_demand_lookup_idx on public.search_intent_demand (normalized_intent, country_code, language_code, checked_at);
alter table public.search_intent_demand enable row level security;
grant select, insert, update on table public.search_intent_demand to service_role;
