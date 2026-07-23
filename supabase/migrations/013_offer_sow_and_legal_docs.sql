-- Statement of Work support on offers + legal document type.

alter table public.legal_documents
  drop constraint if exists legal_documents_document_type_check;

alter table public.legal_documents
  add constraint legal_documents_document_type_check
  check (document_type in (
    'terms_of_service',
    'statement_of_work',
    'service_agreement',
    'privacy_policy',
    'acceptable_use_policy',
    'custom_addendum'
  ));

alter table public.client_offers
  add column if not exists sow_document_id uuid
    references public.legal_documents (id) on delete set null;
