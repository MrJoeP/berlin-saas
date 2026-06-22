-- Migration 025: URL-only Setup + Scan-Rhythmus Toggle.

-- companies.name nullable — wird vom Bot beim Scrape gesetzt.
alter table companies alter column name drop not null;

-- Scan-Rhythmus: daily oder weekly.
alter table companies add column if not exists scan_frequency text
  not null default 'weekly'
  check (scan_frequency in ('daily', 'weekly'));

comment on column companies.scan_frequency is 'daily oder weekly. Cron triggert entsprechend.';

-- Weekly-Cron darf nur weekly-Companies pushen.
select cron.unschedule('weekly-niche-news');
select cron.schedule(
  'weekly-niche-news',
  '0 6 * * 1',
  $$
    insert into public.jobs (type, company_id)
    select 'niche_news_scrape', id
    from public.companies
    where active = true and scan_frequency = 'weekly';
  $$
);

-- Neuer Daily-Cron: jeden Tag 06:00 UTC für daily-Companies.
select cron.schedule(
  'daily-niche-news',
  '0 6 * * *',
  $$
    insert into public.jobs (type, company_id)
    select 'niche_news_scrape', id
    from public.companies
    where active = true and scan_frequency = 'daily';
  $$
);
