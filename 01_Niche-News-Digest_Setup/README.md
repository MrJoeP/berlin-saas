# Projekt 1: Niche-News-Digest plus Company-Setup

Erbt von [GENERAL_CONSTRUCT.md](../GENERAL_CONSTRUCT.md) und [10_WEEKS_ROADMAP.md](../10_WEEKS_ROADMAP.md).

## ZIEL
Foundation-Woche der 10-Wochen-Strecke. Setup-Tool legt die Knowledge-Base an, erster Info-Bot läuft live.

## FUNKTION
Founder durchläuft Multi-Step-Form. Firma, URL, Tagline, Industrie, Keywords, Konkurrenten, Source-Auswahl. Bot scraped Firma und Konkurrenten-Websites, legt Company-Profile in der Knowledge-Base ab. Anschließend zieht ein wöchentlicher Bot aus über 40 Quellen (RSS, NewsAPI, Reddit, HN, ProductHunt), clustert nach Themen, schickt einen sauberen Digest per Email und stellt ihn im Web-Dashboard zur Verfügung.

## OUTPUTS DIESER WOCHE
1. Lauffähiges Setup-Tool mit Auth und Save-Flow.
2. Lauffähige Knowledge-Base in Supabase mit pgvector.
3. Erster Niche-News-Digest, live versendet als Email plus Dashboard-View.
4. Loom-Demo (90 Sekunden, zwei Demo-Setups).
5. Zwei LinkedIn-Posts (Kickoff, Launch).

## STATUS
- Tag 0: Vorbereitung, Schema festziehen.
- Tag 1 bis 5: Bau.
- Tag 6: Demo und Posts.

## DOKUMENTE
- [TAGESPLAN.md](TAGESPLAN.md): Tag-für-Tag-Plan.
- [SCHEMA.md](SCHEMA.md): Datenschema für die Knowledge-Base.
- [SOURCES.md](SOURCES.md): Quellen-Set.
- [STACK.md](STACK.md): Stack-Definition.
- [LINKEDIN_POSTS.md](LINKEDIN_POSTS.md): Drafts für Kickoff und Launch.

## FILTER-CHECK
- Buzzmatic: ein Niche-News-Bot für junge Founder ist klar abseits von Buzzmatic-Custom-Consulting. Sweet Spot bestätigt.
- Agentur: das Setup-Tool und die Knowledge-Base sind direkt wiederverwendbar in der späteren Agenturarbeit.
