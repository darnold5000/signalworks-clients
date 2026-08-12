-- Allow Local Search to persist a legitimate prerequisite-unavailable state.
alter table public.audit_local_search_visibility
  drop constraint if exists audit_local_search_visibility_status_check;

alter table public.audit_local_search_visibility
  add constraint audit_local_search_visibility_status_check
  check (status in ('completed', 'not_applicable', 'not_measured', 'failed'));

notify pgrst, 'reload schema';
