-- Migration 053: Add independent lead temperature to client pipeline.

-- Temperature answers "How strong does this opportunity currently feel?"
-- It is manually set and is NOT derived from pipeline status/stage.

alter table public.client_pipeline
  add column if not exists lead_temperature text not null default 'unknown';

alter table public.client_pipeline
  drop constraint if exists client_pipeline_lead_temperature_check;

alter table public.client_pipeline
  add constraint client_pipeline_lead_temperature_check
  check (
    lead_temperature in (
      'hot',
      'warm',
      'lukewarm',
      'cold',
      'unknown'
    )
  );

comment on column public.client_pipeline.lead_temperature is
  'Manual sales-strength signal (hot/warm/lukewarm/cold/unknown). Independent of status; never derived from pipeline stage.';

create index if not exists client_pipeline_tenant_temperature_idx
  on public.client_pipeline (tenant_id, lead_temperature);
