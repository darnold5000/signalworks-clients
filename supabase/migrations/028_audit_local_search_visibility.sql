create table if not exists public.audit_local_search_visibility (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null unique references public.audit_runs (id) on delete cascade,
  status text not null default 'completed' check (status in ('completed', 'not_applicable', 'failed')),
  score numeric(5, 2),
  profile_key text,
  entered_market text,
  normalized_market text,
  location_name text,
  location_code integer,
  queries_analyzed integer not null default 0,
  found_count integer not null default 0,
  top_three_count integer not null default 0,
  top_ten_count integer not null default 0,
  not_found_count integer not null default 0,
  best_position integer,
  average_position numeric(6, 2),
  results_json jsonb not null default '[]'::jsonb,
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists audit_local_search_visibility_run_idx on public.audit_local_search_visibility (audit_run_id);
alter table public.audit_local_search_visibility enable row level security;
grant select, insert, update on table public.audit_local_search_visibility to service_role;
