alter table public.audit_requests
  add column if not exists business_type_hint text,
  add column if not exists business_type_hint_normalized text;
