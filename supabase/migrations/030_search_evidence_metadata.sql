-- Persist the metadata needed to verify Search Visibility and Local Search measurements.
alter table public.audit_search_visibility
  add column if not exists entered_market text,
  add column if not exists location_code integer,
  add column if not exists audited_domain text,
  add column if not exists result_depth integer not null default 30,
  add column if not exists search_engine text not null default 'google';

alter table public.audit_local_search_visibility
  add column if not exists audited_domain text,
  add column if not exists result_depth integer not null default 20,
  add column if not exists search_engine text not null default 'google';
