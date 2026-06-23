-- Migration 029: Company Context und Source Health.
-- Context macht die Relevanzbewertung weniger keyword-lastig.
-- Source Health macht sichtbar, ob leere Digests echte Ruhe oder Scrape-Probleme sind.

alter table public.companies
  add column if not exists product_description text,
  add column if not exists icp text,
  add column if not exists target_market text,
  add column if not exists negative_keywords text[] not null default '{}';

comment on column public.companies.product_description is 'Kurzbeschreibung des Produkts für Relevanz-Scoring.';
comment on column public.companies.icp is 'Ideal Customer Profile / Zielkunden.';
comment on column public.companies.target_market is 'Zielregion, Sprache oder Markt-Fokus.';
comment on column public.companies.negative_keywords is 'Begriffe, die beim Scrape als irrelevant behandelt werden.';

create table if not exists public.source_health (
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  last_checked_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  items_fetched int not null default 0,
  items_accepted int not null default 0,
  primary key (company_id, source_id)
);

alter table public.source_health enable row level security;

drop policy if exists "source_health_via_company" on public.source_health;
create policy "source_health_via_company"
  on public.source_health for select to authenticated
  using (exists (
    select 1 from public.companies c
    where c.id = source_health.company_id and c.user_id = auth.uid()
  ));

create index if not exists idx_source_health_company_checked
  on public.source_health(company_id, last_checked_at desc);

comment on table public.source_health is
  'Letzter Fetch-Status pro Company-Source. Dient Source-Health UI und Scrape-Diagnose.';
