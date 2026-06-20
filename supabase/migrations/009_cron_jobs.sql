-- Migration 009: Cron Jobs
-- ACHTUNG: NICHT direkt anwenden. Erst Service-Role-Key und Project-URL als Platzhalter ersetzen.
-- Empfehlung: Service-Role-Key in Supabase Vault speichern und über vault.decrypted_secrets lesen.

-- Worker-Tick: ruft jede Minute die worker Edge Function auf.
-- TODO: <PROJECT_URL> ersetzen durch z.B. https://hxvvxoxarhgnizzshwpc.supabase.co
-- TODO: <SERVICE_ROLE_KEY> ersetzen durch service role aus dem Supabase-Dashboard,
--       idealerweise via vault.decrypted_secrets:
--       (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')

select cron.schedule(
  'worker-tick',
  '* * * * *',
  $$
    select net.http_post(
      url := '<PROJECT_URL>/functions/v1/worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Wöchentlicher Niche-News-Scrape, jeden Montag 6 Uhr UTC (8 Uhr DE-Sommerzeit).
-- Enqueued einen niche_news_scrape Job pro aktiver Company.
select cron.schedule(
  'weekly-niche-news',
  '0 6 * * 1',
  $$
    insert into public.jobs (type, company_id)
    select 'niche_news_scrape', id
    from public.companies
    where active = true;
  $$
);

-- Zum De-Registrieren:
-- select cron.unschedule('worker-tick');
-- select cron.unschedule('weekly-niche-news');
