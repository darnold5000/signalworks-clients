-- Migration 024: Audit platform permissions for staff and platform admin.

insert into public.permissions (name, description) values
  (
    'view_audits',
    'View website audit requests, runs, findings, and reports'
  ),
  (
    'run_audits',
    'Create and execute website audits'
  ),
  (
    'manage_audits',
    'Manage audit configuration and internal audit notes'
  ),
  (
    'view_audit_integrations',
    'View tenant audit integrations such as Search Console'
  ),
  (
    'manage_audit_integrations',
    'Connect and manage tenant audit integrations'
  )
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.tenant_id is null
  and r.slug = 'platform_admin'
  and p.name in (
    'view_audits',
    'run_audits',
    'manage_audits',
    'view_audit_integrations',
    'manage_audit_integrations'
  )
on conflict do nothing;
