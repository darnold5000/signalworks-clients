-- Migration 042: Update pipeline CRM status and contact tracking.

alter table public.client_pipeline
  add column if not exists health_check_sent boolean not null default false;

alter table public.client_pipeline
  drop constraint if exists client_pipeline_status_check;

update public.client_pipeline
set status = 'interested'
where status = 'conversation_ongoing';

alter table public.client_pipeline
  add constraint client_pipeline_status_check
  check (
    status in (
      'potential',
      'reached_out',
      'contact_made',
      'interested',
      'proposal_sent',
      'won',
      'not_interested'
    )
  );

-- Contact notes are evidence of an interaction. Status and health-check changes
-- are not. Preserve an explicitly supplied last_contacted_at value.
create or replace function public.client_pipeline_set_last_contacted_at()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.last_contacted_at is null
       and coalesce(btrim(NEW.last_conversation), '') <> '' then
      NEW.last_contacted_at := now();
    end if;
  elsif NEW.last_contacted_at is not distinct from OLD.last_contacted_at
        and coalesce(btrim(NEW.last_conversation), '') <>
          coalesce(btrim(OLD.last_conversation), '')
        and coalesce(btrim(NEW.last_conversation), '') <> '' then
    NEW.last_contacted_at := now();
  end if;

  return NEW;
end;
$$;
