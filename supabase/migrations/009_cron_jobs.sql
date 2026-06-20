-- Migration 009: Cron Jobs
-- Service-Role-Key liegt in der Supabase Vault unter dem Namen 'service_role_key'.
-- Falls noch nicht angelegt: Supabase Dashboard → Project Settings → Vault → New secret
--   name = 'service_role_key'
--   value = <service role key aus Project Settings>

-- Worker-Tick: ruft jede Minute die worker Edge Function auf.
select cron.schedule(
  'worker-tick',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://hxvvxoxarhgnizzshwpc.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
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
