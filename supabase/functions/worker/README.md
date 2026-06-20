# Worker Edge Function

Zentraler Worker für die Job-Queue. Wird via pg_cron alle Minute aufgerufen, holt pending Jobs, dispatcht an die jeweiligen Bot-Handler.

## DEPLOYMENT
```bash
supabase functions deploy worker
```

## MANUELLER AUFRUF
```bash
curl -X POST "$SUPABASE_URL/functions/v1/worker" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## MANUELLE JOB-ENQUEUE PER SQL
Direkt in Supabase SQL-Editor:
```sql
-- Scrape Company nach Setup
insert into jobs (type, company_id)
values ('scrape_company', '<COMPANY_ID>');

-- Niche-News-Run starten
insert into jobs (type, company_id)
values ('niche_news_scrape', '<COMPANY_ID>');
```

Der Worker pickt den Job beim nächsten Tick.

## ARCHITEKTUR
- `index.ts`: HTTP-Handler, Loop über bis zu 5 Jobs pro Tick.
- `../_shared/supabase.ts`: Service-Role Client.
- `../_shared/dispatcher.ts`: Mapping von Job-Type zu Handler.
- `../_shared/types.ts`: Shared TypeScript-Types.

## RETRY-STRATEGIE
- max_retries default 3 (per Job konfigurierbar).
- Exponential Backoff: 60s * 2^retry_count.
- Nach Erschöpfung wird Job als `failed` markiert.

## DEPENDENCIES
Jobs warten via `depends_on` Array auf andere Jobs. Worker prüft das über die `claim_next_job` RPC.

## OBSERVABILITY
```sql
-- Pending Jobs anzeigen
select id, type, retry_count, scheduled_for
from jobs
where status = 'pending'
order by scheduled_for;

-- Letzte Failures
select id, type, error, completed_at
from jobs
where status = 'failed'
order by completed_at desc
limit 10;

-- Throughput letzte 24h
select type, count(*) filter (where status = 'completed') as completed,
       count(*) filter (where status = 'failed') as failed
from jobs
where created_at > now() - interval '24 hours'
group by type;
```
