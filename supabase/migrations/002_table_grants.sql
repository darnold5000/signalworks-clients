-- Table privileges for Supabase API roles (RLS still applies to authenticated).
-- Run after platform foundation + client portal migrations.

grant usage on schema public to authenticated, service_role;

-- Platform tables (idempotent if 003_table_grants already applied)
grant select, insert, update, delete on table public.tenants to authenticated, service_role;
grant select, insert, update, delete on table public.profiles to authenticated, service_role;
grant select on table public.permissions to authenticated, service_role;
grant select on table public.roles to authenticated, service_role;
grant select on table public.role_permissions to authenticated, service_role;
grant select, insert, update, delete on table public.tenant_memberships to authenticated, service_role;

grant execute on function public.is_tenant_member(uuid) to service_role;
grant execute on function public.has_tenant_permission(uuid, text) to service_role;
grant execute on function public.has_platform_permission(text) to service_role;

-- Client portal tables
grant select, insert, update, delete on table public.tenant_portal_settings to authenticated, service_role;
grant select, insert, update, delete on table public.tenant_subscriptions to authenticated, service_role;
grant select, insert, update, delete on table public.service_requests to authenticated, service_role;
grant select, insert, update, delete on table public.documents to authenticated, service_role;
