-- Mirrored for discoverability alongside the client portal schema.
-- Source of truth for Signal Works marketing site acceptances also lives in:
-- SignalWorks/supabase/migrations/001_proposal_acceptances.sql

create extension if not exists "pgcrypto";

create table if not exists public.sw_proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  proposal_slug text not null,
  proposal_number text not null,
  proposal_version integer not null,
  name text not null,
  title text not null,
  email text not null,
  note text,
  approved boolean not null default true,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sw_proposal_acceptances_slug_idx
  on public.sw_proposal_acceptances (proposal_slug);

create index if not exists sw_proposal_acceptances_accepted_at_idx
  on public.sw_proposal_acceptances (accepted_at desc);

alter table public.sw_proposal_acceptances enable row level security;

-- No public policies: reads/writes go through the service role only.
