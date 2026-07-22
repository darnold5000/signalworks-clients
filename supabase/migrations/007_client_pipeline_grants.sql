-- Table privileges for client_pipeline.
-- Run after 006_client_pipeline.sql

grant select, insert, update, delete on table public.client_pipeline to authenticated, service_role;
