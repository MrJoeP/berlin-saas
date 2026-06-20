# Notes vom Nacht-Run

## STATUS VOR NACHT-RUN (gepflegt im Interactive-Mode)
Datum: 2026-06-15

Foundation und Bot-Code sind komplett VOR dem Nacht-Run erledigt. Der ursprünglich geplante Nacht-Run ist damit obsolet, weil die meiste Arbeit interaktiv durchgezogen wurde.

### LIVE IN SUPABASE
Project: `hxvvxoxarhgnizzshwpc`
Tables (alle RLS-enabled):
- industries (8 rows seed)
- sources (0 rows)
- companies (0 rows)
- competitors (0 rows)
- jobs (0 rows)
- digests (0 rows)
- digest_items (0 rows)
- knowledge_entries (0 rows)
- company_sources (0 rows)

Extensions: vector, pg_cron, pg_net
RPC: `public.claim_next_job()` (service_role only)

Migrations applied: 001 bis 008a plus 009a (pg_net). 009 (cron jobs) bleibt als File-Draft, NICHT angewendet.

### CODE IM REPO
- `supabase/functions/_shared/`: types, supabase-client, claude-client, dispatcher.
- `supabase/functions/worker/`: index plus README.
- `supabase/functions/scrape-company/handler.ts`.
- `supabase/functions/scrape-news/handler.ts` (RSS, NewsAPI, Reddit, HN, ProductHunt).
- `supabase/functions/generate-digest/handler.ts`.
- `supabase/functions/send-digest/handler.ts` (Resend).
- `prompts/`: company-profile-extraction, news-clustering, digest-summary.

### OFFENE PUNKTE FÜR MORGEN
1. Edge Functions deployen: `supabase functions deploy worker scrape-company scrape-news generate-digest send-digest`.
2. Secrets via Supabase Vault setzen:
   - ANTHROPIC_API_KEY (Pflicht für Bot-Funktion).
   - FIRECRAWL_API_KEY (optional, sonst Fallback-Scrape).
   - NEWSAPI_KEY (optional).
   - PRODUCTHUNT_TOKEN (optional).
   - RESEND_API_KEY (Pflicht für Email-Versand).
   - FROM_EMAIL (verifizierte Domain in Resend).
3. Migration 009 (cron) mit echtem Project-URL plus Service-Role-Key versehen und anwenden.
4. Lovable-Frontend bauen: Multi-Step-Setup-Form plus Past-Digests-Dashboard.
5. Source-Library befüllen: per SQL-Insert oder Lovable-UI in `public.sources`. Beispiele: einige RSS-Feeds aus den Default-Industrien.
6. End-to-End-Test mit zwei Demo-Setups.

### ANNAHMEN, DIE GETROFFEN WURDEN
- JobType `scrape_competitor` aus `types.ts` entfernt. Konkurrenten-Scrape läuft als Teil von `scrape_company`.
- Email-Versand via Resend (mit `FROM_EMAIL` Env).
- Embeddings sind in der Schema-Spalte vorbereitet, werden aber im Bot-Code noch nicht generiert. Empfehlung: pro Modul iterativ ergänzen, wenn benötigt.
- Multi-Tenant: eine Company pro User in W1.
- DigestType-Enum vorbereitet für die nächsten Module: niche_news, top_post, competitor, ugc.

### ISSUES
Keine bekannt.

## ENDE
Foundation, Schema, Worker-Layer plus alle Bot-Skelette stehen. Bereit für Lovable und Deploy.
