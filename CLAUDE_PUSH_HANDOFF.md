# Claude Push Handoff

## Ziel

Bitte die lokalen Änderungen für den Niche-News-Digest sauber nach GitHub pushen und danach Supabase/Hosting deployen.

Der wichtigste Produktausbau:

- Niche-News-Digest wird zum Founder-Briefing.
- Company Context Editor im Dashboard.
- Job-Status für Briefing Runs.
- Source-Health Anzeige.
- Negative Keywords im Scrape-Filter.
- Cluster werden nach Handlungskategorien sortiert.
- Backend-Synthese nutzt Company Context und erzeugt mehrwertige Felder.

## Wichtige Warnung

Der Worktree enthält bereits viele andere Änderungen und gelöschte Dateien. Bitte nicht blind `git add .` verwenden.

Nicht automatisch stagen, außer bewusst geprüft:

- `D 10_WEEKS_ROADMAP.md`
- `D AGENTS.md`
- `D DEVELOPER_GUIDE.md`
- `D GENERAL_CONSTRUCT.md`
- `D NIGHT_PROMPT.md`
- `D NOTES_NIGHT.md`
- `D ORCHESTRATOR.md`
- `D prompts/company-profile-extraction.md`
- `D prompts/digest-summary.md`
- `D prompts/news-clustering.md`
- `.Rhistory`

Bitte nur die für dieses Feature relevanten Dateien stagen.

## Empfohlener Branch

```bash
git checkout -b codex/niche-news-founder-briefing
```

Falls Branch bereits existiert:

```bash
git checkout codex/niche-news-founder-briefing
```

## Relevante Dateien zum Stagen

Frontend:

```bash
git add frontend/src/features/niche-news/NicheNewsDigest.tsx
git add frontend/src/lib/supabase.ts
git add frontend/src/pages/Dashboard.tsx
git add frontend/src/App.tsx
git add frontend/src/lib/auth.tsx
git add frontend/src/lib/auth-context.ts
git add frontend/src/lib/domain.ts
git add frontend/src/pages/Setup.tsx
```

Supabase Functions und Shared Helpers:

```bash
git add supabase/functions/_shared/types.ts
git add supabase/functions/_shared/claude.ts
git add supabase/functions/_shared/digest_quality.ts
git add supabase/functions/_shared/digest_quality_test.ts
git add supabase/functions/_shared/news_filter.ts
git add supabase/functions/_shared/news_filter_test.ts
git add supabase/functions/_shared/job_chain.ts
git add supabase/functions/_shared/job_chain_test.ts
git add supabase/functions/_shared/test_assert.ts
git add supabase/functions/generate-digest/handler.ts
git add supabase/functions/scrape-company/handler.ts
git add supabase/functions/scrape-news/handler.ts
```

Migrations:

```bash
git add supabase/migrations/027_company_dedup.sql
git add supabase/migrations/028_custom_rss_sources.sql
git add supabase/migrations/029_context_and_source_health.sql
```

Tests:

```bash
git add tests/domain_test.ts
```

Optional, nur wenn diese Tool-Split-Struktur bewusst übernommen werden soll:

```bash
git add supabase/functions/tool-01-niche-news/
git add supabase/functions/tool-02-top-posts/
git add tools/
git add supabase/seeds/002_community_expert.sql
```

Bitte vorher prüfen, ob diese optionalen Ordner wirklich deploy-/repo-relevant sind.

## Was geändert wurde

### 1. Founder-Briefing UI

Datei:

- `frontend/src/features/niche-news/NicheNewsDigest.tsx`

Änderungen:

- Top-3 "Wichtigste Signale".
- Cluster-Sortierung nach Priority Score.
- Cluster-Gruppen:
  - `Jetzt prüfen`
  - `Content-Ideen`
  - `Beobachten`
  - `Niedrige Priorität`
  - `Community News`
- Detailfelder:
  - `Warum relevant`
  - `Einordnung`
  - `Umgang damit`
  - `Offene Fragen`
- Score-Badges für Priorität und Handlungstyp.

### 2. Company Context Editor

Datei:

- `frontend/src/pages/Dashboard.tsx`

Änderungen:

- Context Editor für:
  - Produktbeschreibung
  - ICP
  - Zielmarkt
  - positive Keywords
  - negative Keywords
- Speichert direkt in `companies`.

### 3. Job-Status / Run-Flow

Datei:

- `frontend/src/pages/Dashboard.tsx`

Änderungen:

- Button heißt jetzt `Generate Briefing`.
- Zeigt letzten/aktiven Job:
  - pending
  - running
  - completed
  - failed
- Zeigt Fehler und Retry Count.
- Polling während pending/running Jobs.

### 4. Source Health

Dateien:

- `frontend/src/pages/Dashboard.tsx`
- `supabase/functions/scrape-news/handler.ts`
- `supabase/migrations/029_context_and_source_health.sql`

Änderungen:

- Neue Tabelle `source_health`.
- Pro Source werden geschrieben:
  - last checked
  - last success
  - last error
  - items fetched
  - items accepted
- Dashboard zeigt Trefferquote und Fehler.

### 5. Backend Signal Scoring

Dateien:

- `supabase/functions/_shared/digest_quality.ts`
- `supabase/functions/generate-digest/handler.ts`

Neue Metriken pro Cluster:

- `priority_score`
- `relevance_score`
- `evidence_score`
- `novelty_score`
- `momentum_score`
- Quellenmix
- `action_hint`: `act | watch | content | ignore`
- `signal_reason`

### 6. Backend Synthese erweitert

Datei:

- `supabase/functions/generate-digest/handler.ts`

Neue Felder in `cluster_analyses`:

- `warum_relevant`
- `einordnung`
- `next_move`
- `offene_fragen`
- `signal_metrics`

Wichtig: Alte Digests haben diese Felder nicht. Sichtbar wird der neue Output erst bei neuen Digest-Runs nach Function Deploy.

### 7. Negative Keywords

Dateien:

- `supabase/functions/_shared/news_filter.ts`
- `supabase/functions/scrape-news/handler.ts`

Änderung:

- Items, die negative Keywords matchen, werden vor Clustering entfernt.

## Verifikation lokal

Folgende Checks wurden erfolgreich ausgeführt:

```bash
cd frontend
npm run lint
npm run build
```

```bash
deno check supabase/functions/scrape-news/handler.ts supabase/functions/generate-digest/handler.ts
```

```bash
deno test supabase/functions/_shared/digest_quality_test.ts \
  supabase/functions/_shared/news_filter_test.ts \
  supabase/functions/_shared/job_chain_test.ts \
  tests/domain_test.ts
```

Ergebnis:

- Frontend lint grün.
- Frontend build grün.
- Deno check grün.
- Deno tests grün, 12 Tests bestanden.
- Nur bekannte Vite Chunk-Size-Warnung.

## Commit-Vorschlag

```bash
git commit -m "Improve niche news founder briefing"
```

## Push

```bash
git push -u origin codex/niche-news-founder-briefing
```

Danach bitte PR erstellen oder direkt mergen, je nach Workflow.

## Supabase Deployment

Nach Merge/Push müssen die DB-Migration und Functions deployed werden.

### Migration anwenden

Neue wichtige Migration:

```bash
supabase db push
```

Oder gezielt im Supabase SQL Editor ausführen:

```text
supabase/migrations/029_context_and_source_health.sql
```

Falls noch nicht angewendet, auch:

```text
supabase/migrations/027_company_dedup.sql
supabase/migrations/028_custom_rss_sources.sql
```

### Edge Functions deployen

Mindestens:

```bash
supabase functions deploy worker
supabase functions deploy scrape-news
supabase functions deploy generate-digest
supabase functions deploy scrape-company
```

Falls der Worker-Bundle static imports nutzt, `worker` ist besonders wichtig.

## Nach Deploy testen

1. Offizielle URL öffnen.
2. Company Context ausfüllen:
   - Produkt
   - ICP
   - Zielmarkt
   - Keywords
   - negative Keywords
3. `Generate Briefing` klicken.
4. Job-Status beobachten.
5. Nach Abschluss neuen Niche-News-Digest öffnen.
6. Prüfen, ob sichtbar:
   - Wichtigste Signale
   - Jetzt prüfen / Content-Ideen / Beobachten / Niedrige Priorität
   - Warum relevant
   - Einordnung
   - Umgang damit
   - Source Health Trefferquoten

## Bekannte Hinweise

- Alte Digests zeigen nicht automatisch neue Felder.
- Der neue Output erscheint erst nach neuem Run mit neu deployten Functions.
- Source Health wird erst nach einem neuen `scrape-news` Run gefüllt.
- Wenn `source_health` RLS/Schema noch nicht deployed ist, zeigt die UI keine Health-Daten oder Supabase meldet Query-Fehler.
- Wenn Edge Functions nicht neu deployed sind, werden Jobs weiter mit alter Logik erzeugt.
