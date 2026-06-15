# Tagesplan Woche 1

Sechs Tage. Vier Abende plus Wochenende. Realistische Fragmentierung.

## TAG 1: Schema und Stack-Setup
- Supabase-Projekt anlegen, Auth aktivieren.
- pgvector-Extension aktivieren.
- Tables anlegen nach [SCHEMA.md](SCHEMA.md). companies, competitors, industries, sources, digests, digest_items, knowledge_entries.
- Indexe und Row-Level-Security setzen.
- Lovable-Projekt anlegen, Supabase verbinden.
- Resend-Account für Email-Versand vorbereiten.

Output Tag 1: Supabase steht, Lovable hängt dran, leeres Frontend.

## TAG 2: Setup-Frontend
- Multi-Step-Form in Lovable.
- Schritt 1: Firma, URL, Tagline.
- Schritt 2: Industrie, Keywords.
- Schritt 3: Konkurrenten-Liste (Name plus URL).
- Schritt 4: Source-Auswahl, Vorschläge basierend auf Industrie.
- Save-Flow: schreibt strukturiert in Supabase.
- Auth-Flow mit Magic Link.

Output Tag 2: Founder kann sich einloggen, Profile speichern, Profile sehen.

## TAG 3: Scrape-Layer
- Supabase Edge Function für Firma- und Konkurrenten-Website-Scrape via Firecrawl oder Cheerio.
- LLM-Prompt für Company-Profile-Extraction.
- Scrape-Results in companies und competitors-Tables.

Output Tag 3: Setup-Form fertig, Bot baut Company-Profile nach Submit.

## TAG 4: Niche-News-Engine
- Edge Function für News-Pull: RSS-Parser, NewsAPI, Reddit-API, Hacker-News, ProductHunt.
- Sources werden pro Company aus der sources-Table geladen.
- Items werden geclustered via Claude API.
- Embeddings in pgvector für spätere Wochen.
- Digest-Generation: pro Cluster Top-Items plus kurzer Summary.

Output Tag 4: Manual-Trigger erzeugt ersten Digest. Sichtbar als Database-Entry.

## TAG 5: Output und Schedule
- Email-Template plus Versand via Resend.
- Web-Dashboard in Lovable: aktueller Digest, Past-Digests-Liste, Re-Run-Button.
- pg_cron-Schedule: wöchentlich Montag früh.

Output Tag 5: Erster Digest landet live per Email plus im Dashboard.

## TAG 6: Demo, Polish, LinkedIn
- End-to-End-Test mit zwei Demo-Setups.
- Edge-Cases (leere Sources, Scrape-Fehler) abfangen.
- Loom-Demo, 90 Sekunden.
- Launch-Post finalisieren mit Demo-Beispiel.

Output Tag 6: Tool ist demobar, Launch-Post live.

## PUFFER
Wenn Tag 4 oder 5 hängt, Demo-Frontend simpler halten. Email plus Bare-Bones-Dashboard reichen für Launch.
