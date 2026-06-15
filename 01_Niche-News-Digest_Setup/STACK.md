# Stack-Definition

Schlank, kein n8n. Claude Code übernimmt die Build-Assistance.

## KOMPONENTEN

### Frontend
**Lovable.** Multi-Step-Form, Auth-Anbindung, Dashboard für Past-Digests.

### Backend / DB / Auth / Cron
**Supabase.**
- Postgres mit pgvector für Embeddings.
- Auth via Magic Link.
- Edge Functions für Scrape-Layer und Digest-Generation.
- pg_cron für Schedule.
- Storage später, in W1 nicht nötig.

### LLM
**Claude API.**
- Claude Sonnet 4.6 für Company-Profile-Extraction und News-Clustering.
- Claude Haiku 4.5 für Schnell-Tasks wie Embeddings-Generation und einfache Klassifikation.
- Prompts werden versioniert als Files im Repo abgelegt.

### Build-Assistance
**Claude Code.** Schreibt Edge-Functions, Migrations, Prompt-Files.

### Email-Versand
**Resend.** Einfache Transactional-Email-API, Templates in React-Email.

### Scrape-Helper
**Firecrawl.** Falls Webseiten-Scrape robust sein muss. Sonst Cheerio plus Fetch direkt.

### Externe APIs
- NewsAPI.org (Free-Tier zum Start).
- Reddit-API (kostenlos, OAuth).
- Hacker-News-API via Algolia (kostenlos, kein Auth).
- ProductHunt-API (kostenlos, OAuth).

## DEPLOYMENT
- Lovable hosted Frontend.
- Supabase Edge Functions hosten Backend-Logic.
- Cron-Schedule läuft in Supabase intern.

## KOSTEN-CHECK W1
- Supabase Free-Tier: reicht.
- Lovable: monatlicher Plan, wahrscheinlich schon vorhanden.
- Claude API: pro Digest grob 0,10 bis 0,50 USD je nach Token-Volumen.
- Resend Free-Tier: 3000 Emails pro Monat, reicht.
- NewsAPI Free-Tier: 100 Requests pro Tag, reicht für Demo.

W1 Total: unter 5 USD, vermutlich nichts wenn Tiers ausreichen.

## REPO-STRUKTUR
```
01_Niche-News-Digest_Setup/
  README.md
  TAGESPLAN.md
  SCHEMA.md
  SOURCES.md
  STACK.md
  LINKEDIN_POSTS.md
  /supabase
    /migrations
    /functions
      scrape-company
      scrape-news
      generate-digest
      send-digest
  /lovable
    (Lovable-Projekt-Link, kein lokaler Code)
  /prompts
    company-profile-extraction.md
    news-clustering.md
    digest-summary.md
```
