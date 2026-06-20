-- Migration 007: Company-Sources Junction-Table
-- Mapping welche Sources hat eine Company aktiviert.

create table if not exists public.company_sources (
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, source_id)
);

comment on table public.company_sources is 'Junction-Table: welche Sources hat eine Company aktiviert.';
