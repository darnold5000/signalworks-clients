-- Allow tenant-scoped Statement of Work documents (per-client proposals).

alter table public.legal_documents
  drop constraint if exists legal_documents_platform_types_require_global_tenant;

alter table public.legal_documents
  add constraint legal_documents_platform_types_require_global_tenant check (
    (
      document_type in ('statement_of_work', 'custom_addendum')
      and tenant_id is not null
    )
    or (
      document_type not in ('statement_of_work', 'custom_addendum')
      and tenant_id is null
    )
  );
