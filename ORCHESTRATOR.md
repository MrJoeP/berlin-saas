# Orchestrator

Zentrale Steuerung für alle Bots der 10-Wochen-Strecke. Sitzt vor den eigentlichen Modulen und entscheidet, was wann läuft.

## ZIEL
- Jeder neue Bot ist ein neuer Job-Type, der Orchestrator-Code bleibt gleich.
- Schedules, manuelle Triggers und Bot-zu-Bot-Chains laufen alle über die gleiche Queue.
- Resilient gegen Fehler durch Retries.
- Observable durch persistierten Status pro Job.

## KONZEPT: JOB-QUEUE PLUS WORKER

### Eine Job-Tabelle, viele Bot-Types
Jeder Bot-Lauf ist ein Job. Job hat einen `type` (z.B. `niche_news_scrape`, `cluster_digest`, `send_digest`, `scrape_competitor`). Worker liest pending Jobs, ruft die passende Bot-Function auf.

### Drei Trigger-Wege
1. **Scheduled.** pg_cron schreibt periodisch Jobs in die Queue. Beispiel: jeden Montag 6 Uhr einen `niche_news_scrape`-Job pro Company.
2. **Event.** Frontend-Klick oder anderer Bot schreibt Job. Beispiel: Founder klickt "Run now" im Dashboard.
3. **Chain.** Bot A schreibt nach Abschluss Job für Bot B. Beispiel: nach `niche_news_scrape` automatisch `cluster_digest` enqueuen.

### Dependencies
Jobs können auf andere Jobs warten. `depends_on` ist Array von Job-IDs. Worker zieht einen Job nur, wenn alle Dependencies completed sind.

### Retries
`retry_count` plus `max_retries`. Bei Fehler wird der Job zurück in `pending` gestellt, sofern Retries übrig.

### Concurrency
`FOR UPDATE SKIP LOCKED` in der Worker-Query verhindert, dass zwei Worker den gleichen Job ziehen.

## DATENMODELL

```sql
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  company_id uuid references public.companies(id) on delete cascade,
  payload jsonb not null default '{}',
  status text not null default 'pending', -- pending, running, completed, failed
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

create index idx_jobs_status_scheduled on public.jobs(status, scheduled_for);
create index idx_jobs_company on public.jobs(company_id);
create index idx_jobs_type on public.jobs(type);
```

## WORKER-LOGIK
Pseudocode der `worker` Edge Function. Wird jede Minute von pg_cron aufgerufen.

```
loop:
  job = select * from jobs
          where status = 'pending'
            and scheduled_for <= now()
            and not exists (
              select 1 from unnest(depends_on) as dep_id
              join jobs d on d.id = dep_id
              where d.status != 'completed'
            )
          order by scheduled_for
          limit 1
          for update skip locked

  if no job: exit
  
  mark job as running, set started_at
  
  try:
    result = dispatch(job.type, job.payload, job.company_id)
    mark job completed, save result
  catch error:
    if retry_count < max_retries:
      increment retry_count, reset to pending, scheduled_for = now() + backoff
    else:
      mark failed, save error
```

## DISPATCHER
Mapping von Job-Type zu Bot-Function. Liegt in `supabase/functions/_shared/dispatcher.ts`.

```
const handlers = {
  niche_news_scrape: scrapeNews,
  niche_news_cluster: clusterDigest,
  niche_news_send: sendDigest,
  scrape_company: scrapeCompany,
  scrape_competitor: scrapeCompetitor,
  // ab Woche 2 wachsen
}

function dispatch(type, payload, companyId) {
  const handler = handlers[type]
  if (!handler) throw new Error(`Unknown job type: ${type}`)
  return handler(payload, companyId)
}
```

Neuer Bot = neuer Eintrag in `handlers`. Worker-Code bleibt unverändert.

## SCHEDULE-LAYER
pg_cron-Job, der wöchentlich für alle aktiven Companies News-Scrape-Jobs enqueued.

```sql
select cron.schedule(
  'weekly-niche-news',
  '0 6 * * 1', -- jeden Montag 6 Uhr UTC
  $$
    insert into jobs (type, company_id)
    select 'niche_news_scrape', id
    from companies
    where active = true;
  $$
);
```

Zweiter Cron-Job triggert den Worker alle Minute.

```sql
select cron.schedule(
  'worker-tick',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
    );
  $$
);
```

## CHAIN-LOGIK
Bot A enqueued nach Abschluss Job für Bot B. Beispiel im `scrape-news` Bot:

```ts
// nach erfolgreichem Scrape
await supabase.from('jobs').insert({
  type: 'niche_news_cluster',
  company_id: job.company_id,
  payload: { scrape_job_id: job.id },
  depends_on: [job.id],
})
```

## MONITORING
Dashboard zeigt Jobs pro Company. Filter nach Status. Manueller Re-Run-Button.

Query:
```sql
select type, status, scheduled_for, completed_at, error
from jobs
where company_id = $1
order by scheduled_for desc
limit 50;
```

## SCHEMA-REIHENFOLGE FÜR W1
Migration 003 `companies plus competitors` muss vor 004 `jobs` kommen, weil jobs.company_id referenziert.

Revised Migration-Plan:
- 001 extensions (done)
- 002 industries plus sources (done)
- 003 companies plus competitors
- 004 jobs (Orchestrator-Tabelle)
- 005 digests plus digest_items
- 006 knowledge_entries
- 007 company_sources
- 008 rls policies
- 009 cron jobs

## OFFENE PUNKTE
- Service-Role-Key sicher in pg_cron einhängen (Supabase Vault).
- Bei Failed Jobs: Notification per Email an Founder? Erstmal nicht, in W1 reicht Dashboard.
- Concurrent Worker-Calls: pg_cron triggert minutly, eine Instanz reicht in W1. Skalierung wenn nötig.
