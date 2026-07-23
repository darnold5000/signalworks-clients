-- Additional contact, value, follow-up, and tagging fields for client_pipeline.
-- Apply after 008_client_pipeline_tenant_aware.sql.

alter table public.client_pipeline
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists website_url text,
  add column if not exists estimated_monthly_value_cents integer
    check (estimated_monthly_value_cents is null or estimated_monthly_value_cents >= 0),
  add column if not exists next_follow_up_date date,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists tags text[] not null default '{}';

create index if not exists client_pipeline_tenant_follow_up_idx
  on public.client_pipeline (tenant_id, next_follow_up_date);

-- Auto-set last_contacted_at when conversation notes or outreach status changes.
create or replace function public.client_pipeline_set_last_contacted_at()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if coalesce(btrim(NEW.last_conversation), '') <> '' then
      NEW.last_contacted_at := now();
    elsif NEW.status <> 'potential' then
      NEW.last_contacted_at := now();
    end if;
  elsif TG_OP = 'UPDATE' then
    if coalesce(btrim(NEW.last_conversation), '') <> coalesce(btrim(OLD.last_conversation), '')
       and coalesce(btrim(NEW.last_conversation), '') <> '' then
      NEW.last_contacted_at := now();
    elsif NEW.status is distinct from OLD.status
       and NEW.status <> 'potential' then
      NEW.last_contacted_at := now();
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists client_pipeline_set_last_contacted_at on public.client_pipeline;
create trigger client_pipeline_set_last_contacted_at
  before insert or update on public.client_pipeline
  for each row execute function public.client_pipeline_set_last_contacted_at();
