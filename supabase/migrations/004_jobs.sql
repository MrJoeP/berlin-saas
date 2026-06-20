-- Migration 004: Jobs Queue
-- Zentrale Job-Queue für den Orchestrator. Siehe ORCHESTRATOR.md.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  company_id uuid references public.companies(id) on delete cascade,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  result jsonb,
  error text,
  retry_count int not null default 0,
  max_retries int not null default 3,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  depends_on uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_status_scheduled on public.jobs(status, scheduled_for);
create index if not exists idx_jobs_company on public.jobs(company_id);
create index if not exists idx_jobs_type on public.jobs(type);

comment on table public.jobs is 'Zentrale Job-Queue für den Orchestrator. Worker zieht pending Jobs, dispatcht an Bot-Functions.';
comment on column public.jobs.type is 'Job-Type, z.B. niche_news_scrape, niche_news_cluster, niche_news_send, scrape_company, scrape_competitor.';
comment on column public.jobs.depends_on is 'Array of job IDs that must be completed before this job can run.';
comment on column public.jobs.payload is 'Job-spezifische Daten als JSON.';
