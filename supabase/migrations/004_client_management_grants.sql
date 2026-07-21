-- Table privileges for Phase 1 client management tables.
-- Run after 003_client_management_phase1.sql

grant select, insert, update, delete on table public.tenant_profiles to authenticated, service_role;
grant select, insert, update, delete on table public.tenant_technical_profiles to authenticated, service_role;
grant select, insert, update, delete on table public.tenant_contacts to authenticated, service_role;
grant select, insert, update, delete on table public.tenant_internal_notes to authenticated, service_role;
grant select, insert, update on table public.legal_documents to authenticated, service_role;
grant select, insert, update, delete on table public.client_offers to authenticated, service_role;
grant select, insert, update, delete on table public.client_offer_items to authenticated, service_role;
grant select on table public.purchases to authenticated;
grant select, insert, update on table public.purchases to service_role;
grant select on table public.purchase_items to authenticated;
grant select, insert, update on table public.purchase_items to service_role;
grant select on table public.agreement_acceptances to authenticated;
grant select, insert on table public.agreement_acceptances to service_role;
grant select on table public.tenant_activity_log to authenticated;
grant insert on table public.tenant_activity_log to service_role;
grant select, insert, update on table public.stripe_webhook_events to service_role;

grant execute on function public.client_offer_visible_to_member(text) to authenticated, service_role;
grant execute on function public.enforce_client_offer_item_tenant_match() to authenticated, service_role;
grant execute on function public.enforce_purchase_item_tenant_match() to authenticated, service_role;
