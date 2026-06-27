-- Migration 033: Wöchentlicher Report an festem Wochentag. Kein daily/weekly-Toggle mehr.
-- Ein Briefing pro Woche, der Nutzer wählt einmal fest den Wochentag. Gilt für ALLE Tools.

-- Fester Wochentag pro Company (Postgres dow: 0 = Sonntag … 6 = Samstag). Default Montag.
alter table public.companies
  add column if not exists report_weekday int not null default 1
  check (report_weekday between 0 and 6);

comment on column public.companies.report_weekday is
  'Wochentag des wöchentlichen Reports (Postgres dow: 0=So … 6=Sa). Cron feuert nur an diesem Tag.';

-- Alte Frequenz-Spalte entfernen: es gibt nur noch einen wöchentlichen Report
-- am gewählten report_weekday.
alter table public.companies
  drop column if exists scan_frequency;

-- Alte Crons entfernen: Niche-News (Montags-Fix + Daily) UND Top-Posts (Daily + Weekly),
-- plus ggf. einen bestehenden neuen Dispatch (idempotent). Die Top-Posts-Crons lagen nur
-- direkt auf prod, nicht im Repo, daher hier zur Vollständigkeit mit aufgeführt.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'weekly-niche-news', 'daily-niche-news',
  'weekly-top-posts', 'daily-top-posts',
  'weekly-report-dispatch'
);

-- Neuer Dispatch: täglich 06:00 UTC, feuert pro Company aber NUR am gewählten Wochentag.
-- Enqueued alle Tools als ein wöchentliches Briefing (aktuell niche_news + top_post).
select cron.schedule(
  'weekly-report-dispatch',
  '0 6 * * *',
  $$
    insert into public.jobs (type, company_id)
    select t.type, c.id
    from public.companies c
    cross join (values ('niche_news_scrape'), ('top_post_scrape')) as t(type)
    where c.active = true
      and c.report_weekday = extract(dow from timezone('utc', now()))::int;
  $$
);
