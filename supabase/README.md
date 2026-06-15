# Supabase Layer

## STRUKTUR
- `migrations/` SQL-Files, nummeriert, in Reihenfolge auszuführen.
- `functions/` Edge Functions für Scrape, Clustering, Versand.

## MIGRATIONS IN W1
1. `001_extensions.sql` Vector und pg_cron.
2. `002_industries_sources.sql` Master-Tables, read-only.
3. `003_companies_competitors.sql` Founder-Profile.
4. `004_digests.sql` Digest-Container plus Items.
5. `005_knowledge_entries.sql` Generische Knowledge-Base für spätere Module.
6. `006_company_sources.sql` Verbindungs-Table Company zu Sources.
7. `007_rls_policies.sql` Row-Level-Security.

## AUSFÜHRUNG
Zwei Wege:
1. Supabase-UI, SQL-Editor, Migrations einzeln einfügen und Run klicken.
2. Supabase CLI (`supabase db push`), Migrations werden automatisch in Reihenfolge angewendet.

CLI empfohlen, weil reproduzierbar und versionskontrolliert.

## EDGE FUNCTIONS IN W1
- `scrape-company` Firma- und Konkurrenten-Website-Scrape, Profile-Extraction via Claude.
- `scrape-news` News-Pull aus allen Sources einer Company.
- `generate-digest` Clustering und Digest-Generation via Claude.
- `send-digest` Email-Versand via Resend.
