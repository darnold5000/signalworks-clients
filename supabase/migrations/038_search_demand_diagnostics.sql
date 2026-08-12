alter table public.audit_search_visibility
  add column if not exists demand_provider_request_attempted boolean not null default false,
  add column if not exists demand_provider_http_status integer,
  add column if not exists demand_provider_task_status integer,
  add column if not exists demand_response_status text not null default 'not_attempted',
  add column if not exists demand_parse_status text not null default 'not_attempted',
  add column if not exists demand_result_count integer,
  add column if not exists demand_persistence_attempted boolean not null default false,
  add column if not exists demand_persistence_status text not null default 'not_attempted',
  add column if not exists demand_failure_phase text,
  add column if not exists demand_failure_code text,
  add column if not exists demand_failure_message text;

notify pgrst, 'reload schema';
