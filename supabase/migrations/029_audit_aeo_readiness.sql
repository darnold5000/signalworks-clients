create table if not exists public.audit_aeo_readiness (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null unique references public.audit_runs (id) on delete cascade,
  score numeric(5, 2) not null,
  categories_json jsonb not null default '[]'::jsonb,
  question_coverage_json jsonb not null default '{}'::jsonb,
  findings_json jsonb not null default '[]'::jsonb,
  recommendations_json jsonb not null default '[]'::jsonb,
  evidence_json jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_aeo_readiness_run_idx on public.audit_aeo_readiness (audit_run_id);
alter table public.audit_aeo_readiness enable row level security;
grant select, insert, update on table public.audit_aeo_readiness to service_role;
