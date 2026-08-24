-- Per-client plan and setup inclusions. NULL preserves legacy default behavior;
-- an empty array means the admin intentionally removed every item.
alter table public.tenant_portal_settings
  add column if not exists plan_inclusions text[] null,
  add column if not exists setup_inclusions text[] null;

comment on column public.tenant_portal_settings.plan_inclusions is
  'Client-specific Included with this Plan labels; NULL falls back to application defaults.';
comment on column public.tenant_portal_settings.setup_inclusions is
  'Client-specific Included Setup labels; NULL falls back to application defaults.';
