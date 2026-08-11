alter table public.audit_search_visibility
  add column if not exists failure_phase text,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists successful_query_count integer not null default 0,
  add column if not exists failed_query_count integer not null default 0;

notify pgrst, 'reload schema';
