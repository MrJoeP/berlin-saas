-- Migration 036: Market Radar (Woche 3). Entitäten-Registry, Snapshots, Signale.
-- Digest läuft über die bestehende digests-Tabelle mit type='competitor'.

-- Beobachtete Entitäten: Konkurrenten, Substitute, Komplemente.
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('competitor', 'substitute', 'complement')),
  aliases text[] not null default '{}',
  urls jsonb not null default '{}',          -- {landing, pricing, changelog}
  keywords text[] not null default '{}',
  note text,
  active boolean not null default true,
  drift_streak int not null default 0,        -- Wochen in Folge mit drift_score >= 60
  fetch_health jsonb not null default '{}',   -- pro url_kind: {status, checked_at, error, word_count}
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

-- Wöchentliche Seiten-Snapshots (normalisierter Text-Extrakt + Hash).
create table if not exists entity_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  url_kind text not null check (url_kind in ('landing', 'pricing', 'changelog')),
  url text not null,
  captured_at timestamptz not null default now(),
  text_hash text not null,
  text_extract text not null,
  word_count int not null default 0
);
create index if not exists entity_snapshots_lookup
  on entity_snapshots (entity_id, url_kind, captured_at desc);

-- Signale: Brain-kompatible Atome (title/body Klartext, nicht nur Anzeige-JSON).
create table if not exists entity_signals (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  signal_type text not null check (signal_type in ('page_diff', 'mention', 'news', 'baseline')),
  title text not null,
  body text not null default '',
  why_it_matters text not null default '',
  next_step text not null default '',
  source_url text,
  source_name text,
  lens text not null check (lens in ('competitor', 'substitute', 'complement')),
  tags text[] not null default '{}',
  payload jsonb not null default '{}',        -- diff {removed[], added[]}, Rohdaten
  score int not null default 0,
  severity int not null default 2,
  drift_score int not null default 0,
  detected_at timestamptz not null default now(),
  digest_id uuid references digests(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'digested', 'dropped'))
);
create index if not exists entity_signals_company
  on entity_signals (company_id, status, detected_at desc);

-- RLS: User sieht nur Zeilen der eigenen Companies. Worker nutzt service_role.
alter table entities enable row level security;
alter table entity_snapshots enable row level security;
alter table entity_signals enable row level security;

create policy entities_owner on entities for all to authenticated
  using (exists (select 1 from companies co where co.id = company_id and co.user_id = auth.uid()))
  with check (exists (select 1 from companies co where co.id = company_id and co.user_id = auth.uid()));

create policy entity_snapshots_owner on entity_snapshots for select to authenticated
  using (exists (
    select 1 from entities e join companies co on co.id = e.company_id
    where e.id = entity_id and co.user_id = auth.uid()
  ));

create policy entity_signals_owner on entity_signals for select to authenticated
  using (exists (select 1 from companies co where co.id = company_id and co.user_id = auth.uid()));

-- Radar in den wöchentlichen Dispatch aufnehmen (ersetzt den Cron aus 033).
select cron.unschedule(jobid) from cron.job where jobname = 'weekly-report-dispatch';
select cron.schedule(
  'weekly-report-dispatch',
  '0 6 * * *',
  $$
    insert into public.jobs (type, company_id)
    select t.type, c.id
    from public.companies c
    cross join (values ('niche_news_scrape'), ('top_post_scrape'), ('radar_snapshot')) as t(type)
    where c.active = true
      and c.report_weekday = extract(dow from timezone('utc', now()))::int;
  $$
);
