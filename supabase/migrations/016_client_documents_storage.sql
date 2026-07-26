-- Migration 016: Private storage bucket for tenant document uploads (client portal Documents tab).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists client_documents_storage_select on storage.objects;
create policy client_documents_storage_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-documents'
    and (
      public.has_platform_permission('manage_tenants')
      or public.is_tenant_member(
        ((storage.foldername(name))[1])::uuid
      )
    )
  );

drop policy if exists client_documents_storage_insert on storage.objects;
create policy client_documents_storage_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-documents'
    and public.has_platform_permission('manage_tenants')
  );

drop policy if exists client_documents_storage_delete on storage.objects;
create policy client_documents_storage_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-documents'
    and public.has_platform_permission('manage_tenants')
  );
