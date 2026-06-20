# Nacht-Auftrag für Claude Code

**DEPRECATED.** Schema, Worker, Bot-Skelette plus Frontend wurden im Interactive-Mode am 2026-06-15/06-20 fertiggestellt. Diese Datei bleibt als historische Referenz erhalten.

Modul-Specs liegen ab jetzt unter `../Projekt 1/` (parallel zum Repo), nicht mehr unter `01_Niche-News-Digest_Setup/`.

---

Du bist Claude Code in einem autonomen Nacht-Run. Working Directory: `/Users/dariopilipovic/Berlin SaaS/Berlin SaaS`.

## ZIEL
Migrations 003 bis 009, Edge-Function-Skelette, Prompt-Files. Alles als Code-Draft im Repo, ohne Deploys. Jede saubere Einheit als eigener Commit. Am Ende einmal pushen.

## VORLESEN
Bevor du startest, lies in dieser Reihenfolge und verinnerliche:
1. `GENERAL_CONSTRUCT.md` (Rahmen, Schreibweise, Filter).
2. `10_WEEKS_ROADMAP.md` (10-Wochen-Plan).
3. `ORCHESTRATOR.md` (Job-Queue-Architektur).
4. `01_Niche-News-Digest_Setup/SCHEMA.md` (Schema-Foundation).
5. `01_Niche-News-Digest_Setup/SOURCES.md` (Quellen-Set).
6. `01_Niche-News-Digest_Setup/STACK.md` (Stack-Komponenten).
7. `supabase/migrations/001_extensions.sql` und `002_industries_sources.sql` (was bereits da ist).

## HARTE GUARD-RAILS
- KEIN `supabase db push`, KEIN `supabase functions deploy`, KEIN `supabase secrets set`.
- KEIN externer Service wird angelegt (Resend, NewsAPI, Reddit-OAuth, Firecrawl).
- KEIN API-Call gegen Production-Services.
- KEINE Secrets im Code. Wo später Secrets gebraucht werden, markiere mit `// TODO: <KEY-NAME> in Supabase Vault setzen vor Tag X`.
- KEIN `git push --force`, kein Rewrite von History.
- KEIN Löschen von Files, die nicht von dir angelegt wurden.
- KEIN Anlegen oder Modifizieren von `.env`-Files.
- Wenn etwas unklar ist: NICHT raten. Eintrag in `NOTES_NIGHT.md` mit klarer offener Frage, weitermachen mit dem nächsten Task.
- Wenn etwas fehlschlägt: NICHT destruktiv handeln. Eintrag in `NOTES_NIGHT.md`, weitermachen.

## SPRACHE UND STIL
- Code-Kommentare auf Deutsch, knapp.
- SQL-Kommentare über `comment on table` und `comment on column`.
- TypeScript für Edge Functions, Deno-Runtime, kein Build-Step.
- Keine em-dashes, kein KI-Klang in Markdown- und Text-Output.
- Variablen-Naming: snake_case in SQL, camelCase in TypeScript.

## TASK-LISTE IN REIHENFOLGE

### BLOCK A: SCHEMA-MIGRATIONS
**Status: ERLEDIGT vor Nacht-Run.** Migrations 001 bis 008 sind bereits live in der Supabase-Datenbank und als Files im Repo. Tables: industries, sources, companies, competitors, jobs, digests, digest_items, knowledge_entries, company_sources. Alle RLS-enabled.

Wenn du diesen Block siehst, prüfe nur kurz, ob alle Files in `supabase/migrations/` liegen und ob ihre Inhalte mit ORCHESTRATOR.md und SCHEMA.md konsistent sind. Überspringe Schema-Generierung.

Migration 009 (cron jobs) ist NICHT erledigt. Sie wird im Nacht-Run noch NICHT angewendet, weil Service-Role-Key plus Supabase-Vault-Setup eine bewusste Entscheidung des Founders sind. Schreibe stattdessen einen Code-Draft als `supabase/migrations/009_cron_jobs.sql` mit Platzhaltern `<PROJECT_REF>` und `<SERVICE_ROLE_KEY>` plus TODO-Kommentaren. Nicht via `apply_migration` ausführen.

### BLÖCKE B, C, D, E, F SIND VOR DEM NACHT-RUN BEREITS ERLEDIGT

**Diese Sektion ist nur noch als Doku im Repo, nicht mehr als Nacht-Aufgabe.**

Shared Layer, Worker, Bot-Handler, Prompts, Doku-Updates wurden im Interactive-Mode erledigt. Wenn du den Nacht-Run startest und alles funktioniert, prüfe nur kurz die Konsistenz und mach `git status` um zu sehen ob ungestagte Änderungen liegen. Wenn ja, klare Diffs erklären und committen. Wenn alles clean ist, schreibe Status in `NOTES_NIGHT.md` und beende den Run.

Verbleibende mögliche Aufgaben in der Nacht (nur wenn unbedingt nötig):

#### BLOCK B: EDGE-FUNCTION-SHARED-LAYER (erledigt)
B1. `supabase/functions/_shared/supabase.ts`
- Supabase-Client-Factory mit Service-Role-Key aus Env.
- TypeScript-Types für die wichtigsten Tables (companies, competitors, jobs, digests).

B2. `supabase/functions/_shared/claude.ts`
- Anthropic-Client-Helper.
- Default-Modell: `claude-haiku-4-5-20251001`.
- Wrapper für Messages-API mit System-Prompt und User-Prompt.
- TODO-Marker für ANTHROPIC_API_KEY.

B3. `supabase/functions/_shared/dispatcher.ts`
- Dispatcher-Map wie in ORCHESTRATOR.md.
- Einträge für: niche_news_scrape, niche_news_cluster, niche_news_send, scrape_company, scrape_competitor.
- Jeder Eintrag ruft die jeweilige Handler-Function aus dem entsprechenden Function-Folder auf.

B4. `supabase/functions/_shared/types.ts`
- Job-Type Union.
- Job-Status Enum.
- Common-Interfaces (JobPayload, CompanyProfile).

Commit: `feat(functions): shared layer (supabase, claude, dispatcher, types)`.

### BLOCK C: WORKER
C1. `supabase/functions/worker/index.ts`
- Holt pending Job mit FOR UPDATE SKIP LOCKED.
- Prüft Dependencies (alle depends_on müssen completed sein).
- Markiert als running, dispatcht, markiert als completed oder zurück zu pending mit retry_count++.
- Backoff: exponential, 1 Minute mal 2^retry_count, bis max_retries.

C2. `supabase/functions/worker/README.md`
- Wie der Worker aufgerufen wird.
- Wie man Jobs manuell enqueued (SQL-Snippet).

Commit: `feat(functions): worker mit dispatcher und retry-logic`.

### BLOCK D: BOT-SKELETTE
D1. `supabase/functions/scrape-company/index.ts`
- Input: company_id.
- Schritt 1: companies-Row laden.
- Schritt 2: Firma-Website fetchen (TODO: Firecrawl oder einfacher fetch).
- Schritt 3: Claude-Call mit Prompt aus `prompts/company-profile-extraction.md`.
- Schritt 4: companies.profile_json updaten.
- TODO-Marker für Firecrawl-Key.

D2. `supabase/functions/scrape-news/index.ts`
- Input: company_id.
- Schritt 1: company_sources holen.
- Schritt 2: Pro Source-Type fetchen (RSS-Parser, NewsAPI-Call, Reddit-API, HN-Algolia, ProductHunt).
- Schritt 3: Items in eine temporäre Liste sammeln.
- Schritt 4: Job vom Type niche_news_cluster enqueuen mit payload {items}.
- TODO-Marker für NEWSAPI_KEY und REDDIT_OAUTH.

D3. `supabase/functions/generate-digest/index.ts`
- Input: items aus payload, company_id.
- Schritt 1: Claude-Call mit Prompt aus `prompts/news-clustering.md`.
- Schritt 2: Pro Cluster Claude-Call mit `prompts/digest-summary.md`.
- Schritt 3: digest plus digest_items schreiben.
- Schritt 4: Embeddings via Claude oder OpenAI-API generieren (TODO-Wahl markieren).
- Schritt 5: Job vom Type niche_news_send enqueuen.

D4. `supabase/functions/send-digest/index.ts`
- Input: digest_id.
- Schritt 1: digest plus digest_items laden.
- Schritt 2: Email-Template rendern.
- Schritt 3: Resend-API-Call zum Versand.
- Schritt 4: digests.delivered_at updaten.
- TODO-Marker für RESEND_API_KEY.

Commit nach jedem Bot-Skelett. Commit-Message: `feat(functions): <bot-name> skelett`.

### BLOCK E: PROMPTS
E1. `prompts/company-profile-extraction.md`
- System-Prompt für Profile-Extraction.
- Output-Schema: JSON mit fields {tagline, value_props, target_segments, tone_signals, key_terms}.
- Beispiel-Input und Beispiel-Output.

E2. `prompts/news-clustering.md`
- System-Prompt für Clustering.
- Input: Liste von News-Items.
- Output-Schema: JSON Array of clusters mit {cluster_name, items[]}.

E3. `prompts/digest-summary.md`
- System-Prompt für Summary pro Cluster.
- Input: Cluster mit Items.
- Output: ein kurzer Absatz plus Top-3-Items.

Commit: `feat(prompts): woche 1 prompts (extraction, clustering, summary)`.

### BLOCK F: DOKU-UPDATES
F1. `01_Niche-News-Digest_Setup/STACK.md` ergänzen um Orchestrator-Referenz.
F2. `01_Niche-News-Digest_Setup/TAGESPLAN.md` updaten falls sich die Tagesform durch den Orchestrator-Layer ändert.
F3. `README.md` im Root um kurzen Hinweis auf ORCHESTRATOR.md ergänzen.

Commit: `docs: orchestrator-referenzen einarbeiten`.

### BLOCK G: ABSCHLUSS
G1. `NOTES_NIGHT.md` finalisieren mit Zusammenfassung dessen, was gebaut wurde, und allen offenen Punkten.
G2. `git push origin main`.

## COMMIT-FORMAT
```
<typ>(<scope>): <kurze beschreibung>

<optional body>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Typen: `feat`, `fix`, `docs`, `chore`. Scopes wie oben.

## WENN DU FERTIG BIST
- Pushe nach main.
- Schreibe Zusammenfassung in `NOTES_NIGHT.md`.
- Markiere alle erledigten Blöcke A bis G.
- Liste alle offenen Punkte, Annahmen, und potenziellen Issues.

## WAS DU NICHT TUN DARFST
Nochmal als Schleife: kein Deploy, kein Push außer am Schluss von Block G, keine Secrets, kein Rewrite von History, kein Löschen fremder Files, kein Anmelden bei externen Diensten, kein Raten bei Unklarheit. Lieber sauber stoppen und in NOTES_NIGHT.md vermerken.
