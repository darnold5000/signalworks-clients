-- A client record can exist before any website lifecycle state is established.
-- Existing website statuses are preserved; only the default and allowed values change.

alter table public.tenant_portal_settings
  drop constraint if exists tenant_portal_settings_website_status_check;

alter table public.tenant_portal_settings
  alter column website_status set default 'not_set';

alter table public.tenant_portal_settings
  add constraint tenant_portal_settings_website_status_check
  check (website_status in ('not_set', 'live', 'building', 'staging', 'offline'));
