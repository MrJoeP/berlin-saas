# Berlin SaaS

**10 Wochen, 10 AI-Tools für junge Founder.** Build-in-Public.

Personal Marketing-Stack: jede Woche ein Tool, alle Outputs landen im selben Dashboard und bauen kumulativ eine Knowledge-Base auf.

---

## Woche 1 — Niche-News-Digest

Wöchentlicher KI-kuratierter News-Digest pro Firma. Klassifiziert die Industrie aus der Website, wählt passende Quellen aus einem getierten Source-Pool, scraped, filtert, clustert via Claude und schreibt das Ergebnis ins Dashboard.

### Architektur

```
[Setup-Form]                       Frontend (Netlify)
  └─→ companies + scrape_company   Supabase Postgres
                                          │
   pg_cron (jede Minute) ──→ worker Edge Function
                                          │
   ┌──────────────────────────────────────┼──────────────────────────┐
   ▼                                      ▼                          ▼
 scrape_company         →    niche_news_scrape       →    niche_news_cluster
 (Website + Claude)          (RSS/Reddit/HN/PH)            (Claude Cluster + Summary)
   │                          │                              │
   ▼                          ▼                              ▼
 industry,            tier-aware                       digests +
 niche, keywords,     pre-filter                       digest_items +
 auto-source-pick     (Score/Age/Dedup/Keyword)        knowledge_entries
```

### Source-Tier-System

Jede Quelle bekommt einen Tier, der bestimmt wie Items behandelt werden:

| Tier | Was | Beispiele | Filter |
|------|-----|-----------|--------|
| **T1 — Primärquellen** | Hersteller, offizielle Releases | Google Search Central, OpenAI Blog, Anthropic News | Bypassen Keyword-Filter |
| **T2 — Editorial** | Redaktionell geprüfte Industry-Pubs | Ahrefs, Moz, Search Engine Land, Semrush, t3n | Standard-Filter |
| **T3 — Community** | User-Diskussionen, Votings | Reddit (≥100 upvotes), HN (≥50 points), ProductHunt | Score + Keyword-Match Pflicht |

Pro Cluster wird eine **Confidence** berechnet:
- **`verified`** — mindestens 1 Tier-1-Quelle (Primärquelle)
- **`editorial`** — mindestens 2 Tier-2-Quellen
- **`community`** — nur Tier-3-Quellen

Im Dashboard sieht man pro Cluster die Confidence und pro Item den Tier-Badge.

### Pre-Filter-Pipeline (`scrape-news`)

1. Pro Source bis zu 50 Items roh holen
2. Score-Filter (Reddit upvotes, HN points)
3. Age-Filter (max_age_days pro Source: 7 für T3, 14 für T2, 30 für T1)
4. URL + Title Dedup
5. Keyword-Match gegen Company-Keywords (T1 bypasst, T2 weich, T3 hart)
6. Sortierung T1 → T2 → T3, dann Score, dann Datum
7. Pool-Cap auf 150 Items vor dem LLM-Call

### Orchestrator

Job-Queue-Modell in Postgres mit `FOR UPDATE SKIP LOCKED` für atomare Job-Claims, exponential Backoff, `depends_on` für Job-Chains.

Job-Typen:
- `scrape_company` — Website-Scrape + Industry-Klassifikation + Auto-Source-Pick
- `niche_news_scrape` — Pull aus aktiven Sources + Pre-Filter
- `niche_news_cluster` — Claude Cluster + Summary + Persist

Der Worker tickt jede Minute via pg_cron. Weekly-Cron triggert Montag 06:00 UTC einen Scrape pro aktive Company.

---

## Stack

| Layer | Technologie |
|-------|-------------|
| Frontend | Vite + React + Tailwind, gehostet auf Netlify |
| Backend | Supabase Edge Functions (Deno), pg_cron, pg_net, pgvector |
| Datenbank | Supabase Postgres mit Row-Level Security |
| LLM | Anthropic Claude (Sonnet 4.6 für Cluster/Extraction, Haiku 4.5 für Summaries) |
| Scraping | Native fetch + Firecrawl als Fallback |

## Token-Budget pro Digest-Run

| Items im Pool | Tokens (in + out) | Kosten/Run |
|---------------|-------------------|------------|
| 50 | ~4,5k | ~1,5 ¢ |
| 150 | ~13k | ~4,5 ¢ |
| 500 | ~26k | ~10 ¢ |

Bei einem Run pro Woche und Company: <50 ¢/Monat/Company.

---

## Setup

```bash
# Repo klonen
git clone https://github.com/MrJoeP/berlin-saas.git
cd berlin-saas

# Supabase CLI
brew install supabase/tap/supabase
supabase link --project-ref <project-ref>
supabase db push

# Edge Functions deployen
supabase functions deploy worker --no-verify-jwt

# Secrets setzen (Supabase Dashboard → Edge Functions → Secrets)
#   ANTHROPIC_API_KEY=sk-ant-...
# Optional: FIRECRAWL_API_KEY, NEWSAPI_KEY, PRODUCTHUNT_TOKEN

# Frontend
cd frontend && npm install && npm run dev
# Production: Netlify, env vars VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY
```

---

## Status

- **Woche 1 — Niche-News-Digest** ✅ live mit Tier-System und Pre-Filter
- Woche 2-10 — in Planung, siehe [10_WEEKS_ROADMAP.md](10_WEEKS_ROADMAP.md)

Alle Wochen schreiben in dieselben Tabellen (`digests`, `digest_items`, `knowledge_entries`). Das Dashboard zeigt alle Outputs in einem Feed, gefiltert nach Typ.

---

## Filter vor jedem Bau

1. **Buzzmatic-Filter:** Würde Buzzmatic das selbst bauen? Wenn ja, raus.
2. **Agentur-Filter:** Verkaufbar später, intern nutzbar, oder beides? Wenn keins, schwach.

## Mehr

- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — Cold-Start-Anleitung für Full-Stack-Devs
- [ORCHESTRATOR.md](ORCHESTRATOR.md) — Job-Queue-Detail-Architektur
- [10_WEEKS_ROADMAP.md](10_WEEKS_ROADMAP.md) — Wochen-Plan
- [GENERAL_CONSTRUCT.md](GENERAL_CONSTRUCT.md) — Rahmen und Filter
