-- Migration 027: persisted Google organic search visibility snapshots.

create table if not exists public.audit_search_visibility (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null unique references public.audit_runs (id) on delete cascade,
  status text not null default 'completed' check (status in ('completed', 'unavailable', 'failed')),
  score numeric(5, 2),
  business_name text,
  city text,
  state text,
  location_name text,
  queries_analyzed integer not null default 0,
  first_page_count integer not null default 0,
  top_three_count integer not null default 0,
  positions_11_20_count integer not null default 0,
  positions_21_30_count integer not null default 0,
  not_found_count integer not null default 0,
  best_discovery_query text,
  best_discovery_position integer,
  results_json jsonb not null default '[]'::jsonb,
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists audit_search_visibility_run_idx
  on public.audit_search_visibility (audit_run_id);

alter table public.audit_search_visibility enable row level security;
grant select, insert, update on table public.audit_search_visibility to service_role;
