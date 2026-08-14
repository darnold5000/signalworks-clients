-- Migration 041: Cache filtered keyword discovery by domain and market; persist discovery diagnostics.

create table if not exists public.search_keyword_discovery (
  id uuid primary key default gen_random_uuid(),
  normalized_domain text not null,
  location_code integer not null,
  language_code text not null default 'en',
  source text not null,
  candidates_json jsonb not null default '[]'::jsonb,
  provider_result_count integer,
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_domain, location_code, language_code)
);

create index if not exists search_keyword_discovery_lookup_idx
  on public.search_keyword_discovery (normalized_domain, location_code, language_code, checked_at);

alter table public.search_keyword_discovery enable row level security;
grant select, insert, update on table public.search_keyword_discovery to service_role;

alter table public.audit_search_visibility
  add column if not exists discovery_diagnostics_json jsonb;

notify pgrst, 'reload schema';
