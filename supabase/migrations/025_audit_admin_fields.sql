-- Migration 025: Admin audit fields — internal notes and structured recommendation support.

alter table public.audit_requests
  add column if not exists internal_notes text;

comment on column public.audit_requests.internal_notes is
  'Staff-only notes captured when the audit was requested. Not shown on public reports.';

alter table public.audit_recommendations
  add column if not exists supporting_finding_keys jsonb not null default '[]'::jsonb;

comment on column public.audit_recommendations.supporting_finding_keys is
  'Stable finding check_keys that triggered this recommendation.';
