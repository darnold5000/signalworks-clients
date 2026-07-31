-- Migration 023: Website audit platform tables (requests, runs, findings, scores, recommendations, artifacts, integrations).

-- ---------------------------------------------------------------------------
-- audit_requests — intake for public leads and tenant-scoped client audits
-- ---------------------------------------------------------------------------

create table if not exists public.audit_requests (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid references public.tenants (id) on delete cascade,

  audit_type text not null check (
    audit_type in (
      'public',
      'client_health',
      'technical',
      'seo',
      'aeo',
      'operations',
      'security',
      'performance'
    )
  ),

  requested_url text not null,
  normalized_url text not null,
  normalized_domain text not null,

  business_name text,
  contact_name text,
  contact_email text,
  city text,

  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),

  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  requested_by_user_id uuid references auth.users (id) on delete set null,
  pipeline_lead_id uuid references public.client_pipeline (id) on delete set null,

  public_access_token text not null unique default encode(gen_random_bytes(32), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint audit_requests_public_tenant_check check (
    tenant_id is not null or audit_type = 'public'
  )
);

create index if not exists audit_requests_tenant_created_idx
  on public.audit_requests (tenant_id, created_at desc)
  where tenant_id is not null;

create index if not exists audit_requests_normalized_domain_created_idx
  on public.audit_requests (normalized_domain, created_at desc);

create index if not exists audit_requests_public_token_idx
  on public.audit_requests (public_access_token);

create index if not exists audit_requests_status_idx
  on public.audit_requests (status, created_at desc);

drop trigger if exists audit_requests_set_updated_at on public.audit_requests;
create trigger audit_requests_set_updated_at
  before update on public.audit_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_runs — immutable completed snapshots; progress_json during execution
-- ---------------------------------------------------------------------------

create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),

  audit_request_id uuid not null references public.audit_requests (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,

  status text not null default 'queued' check (
    status in ('queued', 'running', 'partially_succeeded', 'succeeded', 'failed')
  ),

  started_at timestamptz,
  completed_at timestamptz,

  engine_version text not null,
  scope_version text not null,

  overall_score numeric(5, 2) check (
    overall_score is null or (overall_score >= 0 and overall_score <= 100)
  ),
  summary text,

  error_code text,
  error_message_internal text,

  -- Collector-level progress during sync or future async execution.
  progress_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists audit_runs_request_created_idx
  on public.audit_runs (audit_request_id, created_at desc);

create index if not exists audit_runs_tenant_created_idx
  on public.audit_runs (tenant_id, created_at desc)
  where tenant_id is not null;

create index if not exists audit_runs_status_idx
  on public.audit_runs (status, created_at desc);

comment on column public.audit_runs.progress_json is
  'Per-collector execution progress (phase, collector status, timestamps). '
  'Updated during synchronous runs today; same shape for a future queue worker.';

-- ---------------------------------------------------------------------------
-- audit_findings
-- ---------------------------------------------------------------------------

create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),

  audit_run_id uuid not null references public.audit_runs (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,

  category text not null check (
    category in (
      'performance',
      'technical',
      'seo',
      'local_seo',
      'aeo',
      'conversion',
      'accessibility',
      'security',
      'operations',
      'email_auth',
      'content'
    )
  ),

  check_key text not null,
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  status text not null check (
    status in ('pass', 'warning', 'fail', 'unavailable', 'manual_review')
  ),

  score numeric(5, 2),
  title text not null,
  summary text not null,

  evidence_json jsonb not null default '{}'::jsonb,
  source_type text not null check (
    source_type in ('verified', 'estimated_third_party', 'automated', 'manual_review')
  ),
  source_label text not null,

  is_public boolean not null default false,
  is_client_visible boolean not null default true,

  created_at timestamptz not null default now()
);

create index if not exists audit_findings_run_idx
  on public.audit_findings (audit_run_id);

create index if not exists audit_findings_run_check_key_idx
  on public.audit_findings (audit_run_id, check_key);

create unique index if not exists audit_findings_run_check_key_unique_idx
  on public.audit_findings (audit_run_id, check_key);

-- ---------------------------------------------------------------------------
-- audit_scores
-- ---------------------------------------------------------------------------

create table if not exists public.audit_scores (
  id uuid primary key default gen_random_uuid(),

  audit_run_id uuid not null references public.audit_runs (id) on delete cascade,
  category text not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  weight numeric(5, 2) not null default 0,
  finding_count integer not null default 0,

  created_at timestamptz not null default now(),

  unique (audit_run_id, category)
);

-- ---------------------------------------------------------------------------
-- audit_recommendations
-- ---------------------------------------------------------------------------

create table if not exists public.audit_recommendations (
  id uuid primary key default gen_random_uuid(),

  audit_run_id uuid not null references public.audit_runs (id) on delete cascade,
  recommendation_key text not null,

  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  impact text,
  effort text,

  signalworks_service_key text,
  is_public boolean not null default false,
  is_client_visible boolean not null default true,

  status text not null default 'recommended' check (
    status in (
      'recommended',
      'planned',
      'in_progress',
      'completed',
      'dismissed',
      'client_action_required'
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (audit_run_id, recommendation_key)
);

drop trigger if exists audit_recommendations_set_updated_at on public.audit_recommendations;
create trigger audit_recommendations_set_updated_at
  before update on public.audit_recommendations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_artifacts
-- ---------------------------------------------------------------------------

create table if not exists public.audit_artifacts (
  id uuid primary key default gen_random_uuid(),

  audit_run_id uuid not null references public.audit_runs (id) on delete cascade,
  artifact_type text not null check (
    artifact_type in (
      'html_report',
      'pdf_report',
      'screenshot',
      'pagespeed_response',
      'collector_output'
    )
  ),
  storage_path text not null,
  content_type text not null,

  created_at timestamptz not null default now()
);

create index if not exists audit_artifacts_run_idx
  on public.audit_artifacts (audit_run_id);

-- ---------------------------------------------------------------------------
-- audit_integrations — tenant-scoped provider metadata (secrets elsewhere)
-- ---------------------------------------------------------------------------

create table if not exists public.audit_integrations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (
    provider in (
      'search_console',
      'pagespeed',
      'rank_tracking',
      'google_business_profile',
      'analytics'
    )
  ),

  status text not null default 'disconnected' check (
    status in ('disconnected', 'connected', 'error')
  ),

  config_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, provider)
);

drop trigger if exists audit_integrations_set_updated_at on public.audit_integrations;
create trigger audit_integrations_set_updated_at
  before update on public.audit_integrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.audit_requests enable row level security;
alter table public.audit_runs enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_scores enable row level security;
alter table public.audit_recommendations enable row level security;
alter table public.audit_artifacts enable row level security;
alter table public.audit_integrations enable row level security;

-- Staff with view_audits can read tenant and public-lead audit data.
drop policy if exists audit_requests_select on public.audit_requests;
create policy audit_requests_select
  on public.audit_requests for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
    )
  );

drop policy if exists audit_runs_select on public.audit_runs;
create policy audit_runs_select
  on public.audit_runs for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
    )
  );

drop policy if exists audit_findings_select on public.audit_findings;
create policy audit_findings_select
  on public.audit_findings for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or (
      tenant_id is not null
      and public.is_tenant_member(tenant_id)
      and is_client_visible
    )
  );

drop policy if exists audit_scores_select on public.audit_scores;
create policy audit_scores_select
  on public.audit_scores for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or (
      exists (
        select 1
        from public.audit_runs ar
        where ar.id = audit_run_id
          and ar.tenant_id is not null
          and public.is_tenant_member(ar.tenant_id)
      )
    )
  );

drop policy if exists audit_recommendations_select on public.audit_recommendations;
create policy audit_recommendations_select
  on public.audit_recommendations for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or (
      exists (
        select 1
        from public.audit_runs ar
        where ar.id = audit_run_id
          and ar.tenant_id is not null
          and public.is_tenant_member(ar.tenant_id)
      )
      and is_client_visible
    )
  );

drop policy if exists audit_artifacts_select on public.audit_artifacts;
create policy audit_artifacts_select
  on public.audit_artifacts for select
  to authenticated
  using (
    public.has_platform_permission('view_audits')
    or exists (
      select 1
      from public.audit_runs ar
      where ar.id = audit_run_id
        and ar.tenant_id is not null
        and public.is_tenant_member(ar.tenant_id)
    )
  );

drop policy if exists audit_integrations_select on public.audit_integrations;
create policy audit_integrations_select
  on public.audit_integrations for select
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.has_platform_permission('view_audit_integrations')
  );

-- Mutations: staff permissions only (execution uses service_role).
drop policy if exists audit_requests_insert on public.audit_requests;
create policy audit_requests_insert
  on public.audit_requests for insert
  to authenticated
  with check (public.has_platform_permission('run_audits'));

drop policy if exists audit_integrations_manage on public.audit_integrations;
create policy audit_integrations_manage
  on public.audit_integrations for all
  to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_audit_integrations')
  )
  with check (
    public.is_tenant_member(tenant_id)
    and public.has_platform_permission('manage_audit_integrations')
  );

grant select on table public.audit_requests to authenticated, service_role;
grant insert on table public.audit_requests to authenticated, service_role;
grant update on table public.audit_requests to service_role;

grant select on table public.audit_runs to authenticated, service_role;
grant insert, update on table public.audit_runs to service_role;

grant select on table public.audit_findings to authenticated, service_role;
grant insert on table public.audit_findings to service_role;

grant select on table public.audit_scores to authenticated, service_role;
grant insert on table public.audit_scores to service_role;

grant select on table public.audit_recommendations to authenticated, service_role;
grant insert, update on table public.audit_recommendations to service_role;

grant select on table public.audit_artifacts to authenticated, service_role;
grant insert on table public.audit_artifacts to service_role;

grant select, insert, update, delete on table public.audit_integrations
  to authenticated, service_role;
