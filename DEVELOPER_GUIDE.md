# Developer Guide: Berlin SaaS

A full-stack reference for anyone picking up this project cold. Covers vision, architecture, schema, stack, and setup. No environment-specific values included — those go into your own `.env` and Supabase Vault.

---

## Vision

10-week build-in-public challenge: one AI-powered marketing tool per week, built for early-stage B2B founders. The tools form a progressive knowledge system — early weeks collect information, later weeks produce assets from it.

Target user: a young founder (10–50 employees) who needs marketing infrastructure but cannot afford an agency or a full-time marketer.

Distribution: LinkedIn build-in-public. Each week ends with a launch post.

### The 10-Week Arc

| Week | Module | Phase |
|------|--------|-------|
| 1 | Niche-News-Digest + Company-Setup | Info-Gathering |
| 2 | Top-Post-Digest (LinkedIn top posts by niche) | Info-Gathering |
| 3 | Wettbewerbs-Monitor (competitor tracking) | Info-Gathering |
| 4 | UGC-Hunter (user-generated content finder) | Info-Gathering |
| 5 | FAQ- und Objection-Handler | Transition |
| 6 | One-Pager-Builder | Asset-Production |
| 7 | Asset-Producer (open slot) | Asset-Production |
| 8 | Lead-Magnet-Engine | Asset-Production |
| 9 | Newsletter-Engine | Asset-Production |
| 10 | Endgegner (open slot) | Asset-Production |

All modules share a single Supabase backend and a central knowledge base. Each module reads from and writes to the same `companies`, `knowledge_entries`, and `digests` tables.

---

## Filters (apply to every new feature before building)

1. **Buzzmatic-Filter**: Would a marketing agency build and sell this as a consulting product? If yes, out of scope — this is a founder self-serve tool, not agency tooling.
2. **Agentur-Filter**: Can this be used internally by a small agency later, or sold as a white-label module? If neither, the feature is weak.
3. **No-Go list**: Wedge-finder tools, founder-identity/pitch tools, and pitch-deck coaches are explicitly excluded. The system is for marketing execution, not positioning strategy.

---

## Week 1: Niche-News-Digest + Company-Setup

### What it does

A founder fills a multi-step setup form:
- Company name, URL, tagline
- Industry + niche keywords
- Competitor names + URLs
- Source selection (RSS feeds, Reddit subreddits, Hacker News queries)

After submit, a bot scrapes the company and competitor websites and extracts a structured marketing profile using Claude. A weekly cron job then scrapes 40+ niche sources (RSS, NewsAPI, Reddit, HN, ProductHunt), clusters the results by topic using Claude, and delivers a digest via email and a web dashboard.

### Outputs

1. Setup form with auth (magic link)
2. Knowledge base in Supabase with pgvector
3. Weekly niche-news digest, sent by email + shown in dashboard
4. Loom demo (90 seconds, two demo setups)
5. Two LinkedIn posts (kickoff + launch)

---

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Vite + React 19 + TypeScript + Tailwind v4 | Custom UI components, no shadcn/ui CLI needed |
| Routing | React Router v7 | |
| Auth | Supabase Auth (magic link) | No password flow |
| Database | Supabase Postgres | pgvector for embeddings |
| Backend | Supabase Edge Functions (Deno/TypeScript) | Single `worker` function, no separate per-bot deployments |
| Job Queue | Custom `jobs` table + `claim_next_job()` Postgres function | FOR UPDATE SKIP LOCKED, exponential backoff |
| Scheduling | pg_cron + pg_net | Calls worker Edge Function on a schedule |
| LLM | Anthropic Claude API | Haiku 4.5 default, Sonnet 4.6 for extraction + clustering |
| Email | Resend | Digest delivery |
| Web Scraping | Firecrawl (optional) | Falls back to raw fetch + HTML stripping if no key |
| Version Control | GitHub | Mono-repo: one repo, all 10 modules share supabase/ and prompts/ |
| Frontend Hosting | Lovable (synced from GitHub) or Vite build | |

---

## Repository Structure

```
berlin-saas/
├── frontend/                  # Vite + React frontend
│   ├── src/
│   │   ├── components/ui/     # Button, Input, Card (custom, thin)
│   │   ├── lib/               # supabase.ts, auth.tsx, utils.ts
│   │   ├── pages/             # Login.tsx, Setup.tsx, Dashboard.tsx
│   │   └── App.tsx            # React Router setup
│   ├── vite.config.ts
│   └── .env.local             # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
├── supabase/
│   ├── migrations/            # All schema migrations, numbered
│   ├── functions/
│   │   ├── _shared/           # supabase.ts, claude.ts, types.ts, dispatcher.ts
│   │   ├── worker/            # index.ts — the only deployed Edge Function
│   │   ├── scrape-company/    # handler.ts — imported by dispatcher
│   │   ├── scrape-news/       # handler.ts
│   │   ├── generate-digest/   # handler.ts
│   │   └── send-digest/       # handler.ts
│   └── seeds/
│       └── 001_sources.sql    # 22 seeded sources across 8 industries
├── prompts/
│   ├── company-profile-extraction.md
│   ├── news-clustering.md
│   └── digest-summary.md
├── GENERAL_CONSTRUCT.md       # Project rules and filters
├── ORCHESTRATOR.md            # Job queue architecture spec
└── 10_WEEKS_ROADMAP.md        # Module roadmap with status
```

---

## Database Schema

All tables have RLS enabled. All business tables are scoped to `companies.user_id`.

### Master tables (read-only for authenticated users)

```sql
-- Industry taxonomy
industries (id uuid, name text, slug text, is_default bool)

-- News sources, seeded with 22 defaults across 8 industries
sources (
  id uuid,
  name text,
  url text,
  type source_type,       -- rss | newsapi | reddit | hackernews | producthunt | twitter | custom
  industry_tags text[],
  config jsonb,           -- source-specific config (subreddit, keywords, etc.)
  is_default bool
)
```

### Business tables (scoped per user via company)

```sql
companies (
  id uuid,
  user_id uuid,           -- references auth.users
  name text,
  url text,
  tagline text,
  industry text,
  niche text,
  keywords text[],
  voice_sample text,
  profile_json jsonb,     -- extracted by scrape_company job: tagline, value_props, target_segments, tone_signals, key_terms
  active bool
)

competitors (
  id uuid,
  company_id uuid,
  name text,
  url text,
  profile_json jsonb
)

company_sources (
  company_id uuid,
  source_id uuid,
  active bool
)

-- Job queue (orchestrator)
jobs (
  id uuid,
  type job_type,          -- scrape_company | niche_news_scrape | niche_news_cluster | niche_news_send
  company_id uuid,
  payload jsonb,
  status job_status,      -- pending | running | completed | failed
  result jsonb,
  error text,
  retry_count int,
  max_retries int,        -- default 3
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  depends_on uuid[],      -- job IDs that must complete before this runs
  created_at timestamptz
)

digests (
  id uuid,
  company_id uuid,
  type digest_type,       -- niche_news | top_post | competitor | ugc
  title text,
  delivered_at timestamptz
)

digest_items (
  id uuid,
  digest_id uuid,
  cluster text,
  title text,
  summary text,
  source_url text,
  source_name text,
  published_at timestamptz,
  raw_json jsonb,
  embedding vector(1536)  -- ivfflat index for similarity search
)

-- Shared knowledge base (used by all 10 modules)
knowledge_entries (
  id uuid,
  company_id uuid,
  type text,              -- niche_trend, competitor_signal, ugc_example, etc.
  content text,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamptz
)
```

### Key Postgres function

```sql
-- Atomic job claim with dependency check
-- SECURITY DEFINER, granted to service_role only
CREATE FUNCTION claim_next_job() RETURNS SETOF jobs AS $$
  UPDATE jobs SET status = 'running', started_at = now()
  WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'pending'
      AND scheduled_for <= now()
      AND (
        depends_on = '{}' OR
        NOT EXISTS (
          SELECT 1 FROM jobs j2
          WHERE j2.id = ANY(jobs.depends_on)
            AND j2.status != 'completed'
        )
      )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
$$ LANGUAGE sql;
```

---

## Orchestrator Architecture

The entire backend runs through a single `worker` Edge Function. No separate function per bot.

```
pg_cron (every minute)
  → pg_net HTTP POST → /functions/v1/worker
      → claim_next_job() [Postgres, atomic]
          → dispatcher.ts [static imports]
              → scrape-company/handler.ts
              → scrape-news/handler.ts
              → generate-digest/handler.ts
              → send-digest/handler.ts
```

### Job chain for a weekly digest

```
[scrape_company]              ← triggered by Setup form submit
       ↓
[niche_news_scrape]           ← triggered by pg_cron weekly or manual "Run now"
       ↓ (depends_on: niche_news_scrape)
[niche_news_cluster]          ← enqueued by scrape-news handler
       ↓ (depends_on: niche_news_cluster)
[niche_news_send]             ← enqueued by generate-digest handler
```

### Retry logic

- Exponential backoff: `60s * 2^retry_count`
- Default `max_retries`: 3
- After max retries: status = `failed`

### Enqueue a job manually (SQL)

```sql
INSERT INTO jobs (type, company_id, payload)
VALUES ('niche_news_scrape', '<company_id>', '{}');
```

---

## Edge Function: Worker

Only ONE Edge Function is deployed (`worker`). All bot handlers are statically imported into the worker bundle via `dispatcher.ts`. This avoids circular dependency issues with dynamic imports in Deno.

### File: `supabase/functions/worker/index.ts`

- Uses `Deno.serve()`
- Loops up to 5 jobs per tick (`MAX_JOBS_PER_TICK`)
- Calls `claim_next_job()` RPC
- Dispatches to handler
- On success: marks `completed`, stores `result`
- On failure: exponential backoff or marks `failed`

### Secrets required in Supabase Vault

```
ANTHROPIC_API_KEY       # Required — Claude API for extraction and clustering
RESEND_API_KEY          # Required — email delivery
FROM_EMAIL              # Required — verified sender domain in Resend
FIRECRAWL_API_KEY       # Optional — better web scraping; falls back to fetch
NEWSAPI_KEY             # Optional — NewsAPI.org source
PRODUCTHUNT_TOKEN       # Optional — ProductHunt GraphQL API
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase into Edge Functions.

### Deploy

```bash
supabase functions deploy worker --project-ref <project-ref>
```

### Set secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=<value> --project-ref <project-ref>
supabase secrets set RESEND_API_KEY=<value> --project-ref <project-ref>
supabase secrets set FROM_EMAIL=<value> --project-ref <project-ref>
```

---

## Cron Jobs (Migration 009 — apply manually)

`supabase/migrations/009_cron_jobs.sql` is a draft. Before applying, replace:
- `<PROJECT_URL>` with your Supabase project URL (`https://<ref>.supabase.co`)
- `<SERVICE_ROLE_KEY>` with the service role key from Supabase dashboard

The file schedules:
1. Worker tick every minute via `pg_net` HTTP call
2. Weekly niche news scrape job insert (Monday 08:00 UTC)

---

## Frontend

### Stack

- Vite 6 + React 19 + TypeScript
- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`)
- React Router v7
- Supabase JS client (`@supabase/supabase-js`)
- `lucide-react` for icons
- Custom UI components in `src/components/ui/` (Button, Input, Card)

### Design tokens (in `src/index.css` via `@theme`)

- Background: `#fafafa` (off-white)
- Foreground: `#0a0a0a`
- Accent: `#0a66c2` (LinkedIn blue — intentional, target audience lives on LinkedIn)
- Border: `#e5e5e5`
- Muted: `#737373`
- Font: system-ui stack

### Routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login.tsx | Public only |
| `/setup` | Setup.tsx | Auth required |
| `/` | Dashboard.tsx | Auth required |

Auth uses Supabase magic link (`signInWithOtp`). No password flow.

### Setup form (4 steps)

1. Company info: name, URL, tagline
2. Industry, niche keywords, voice sample
3. Competitors: name + URL, add multiple
4. Source selection: checkboxes from seeded sources

On submit: inserts `companies`, `competitors`, `company_sources`, enqueues `scrape_company` job.

### Environment variables

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<value>
```

Note: Supabase publishable key (formerly anon key) is safe to expose client-side. RLS policies enforce data isolation.

---

## Local Setup

### Prerequisites

- Node.js 20+
- Supabase CLI (`brew install supabase/tap/supabase`)
- GitHub CLI (`brew install gh`)
- A Supabase project (cloud, not local — pgvector + pg_cron + pg_net work best on cloud)

### Steps

```bash
# Clone
git clone https://github.com/MrJoeP/berlin-saas.git
cd berlin-saas

# Frontend
cd frontend
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev

# Link Supabase project
supabase link --project-ref <project-ref>

# Apply migrations (if not already applied)
supabase db push

# Apply seeds
psql <connection-string> -f supabase/seeds/001_sources.sql

# Deploy worker
supabase functions deploy worker --project-ref <project-ref>

# Set required secrets
supabase secrets set ANTHROPIC_API_KEY=<value> --project-ref <project-ref>
supabase secrets set RESEND_API_KEY=<value> --project-ref <project-ref>
supabase secrets set FROM_EMAIL=<value> --project-ref <project-ref>

# Apply cron migration (after filling in placeholders)
# Edit supabase/migrations/009_cron_jobs.sql first
supabase db push
```

---

## Claude API Usage Pattern

Two models in use:

| Model | Used for | Cost tier |
|-------|----------|-----------|
| `claude-haiku-4-5-20251001` | Default (fast, cheap) | Low |
| `claude-sonnet-4-6` | Profile extraction, news clustering, digest summaries | Medium |

Helper in `supabase/functions/_shared/claude.ts`:
- `callClaude(options)` — returns text
- `callClaudeJSON<T>(options)` — parses JSON, strips markdown fences, typed

All prompts are documented in `prompts/` as markdown files. The actual system prompts are embedded directly in the handler files — the markdown files are the specification.

---

## LLM Prompt Specs

### `prompts/company-profile-extraction.md`

Input: raw website HTML/markdown + company metadata.
Output JSON:
```json
{
  "tagline": "string",
  "value_props": ["string"],
  "target_segments": ["string"],
  "tone_signals": ["string"],
  "key_terms": ["string"]
}
```

### `prompts/news-clustering.md`

Input: list of news items (`[idx] title (source_name)`).
Output JSON:
```json
{
  "clusters": [
    { "cluster_name": "string", "item_indices": [0, 3, 5] }
  ]
}
```
Max 5 clusters. Items without clear theme are excluded.

### `prompts/digest-summary.md`

Input: cluster name + list of items.
Output: 3–4 sentence plain-text paragraph. No marketing language. Written for a founder who needs to understand the signal fast.

---

## Source Types and Config

Each source row has a `config` JSONB field. Shape depends on `type`:

```jsonb
-- rss: no config needed, URL is the feed
{}

-- reddit
{ "subreddit": "SaaS" }

-- hackernews
{ "query": "AI startup", "min_score": 50 }

-- newsapi
{ "keywords": ["AI", "B2B", "SaaS"] }

-- producthunt
{ "topic": "artificial-intelligence" }
```

---

## Key Architecture Decisions

**Single Edge Function, not one per bot**: Supabase Edge Functions bundle on deploy. Static imports in `dispatcher.ts` include all handlers in the worker bundle. Dynamic imports (`await import(...)`) were tried first but caused bundling issues in Deno. Static imports solved it.

**Mono-repo**: All 10 weekly modules share `supabase/` and `prompts/`. No separate repos. One Supabase project for all weeks.

**Custom UI components over shadcn/ui**: shadcn/ui CLI requires interactive terminal input — not compatible with autonomous build mode. Thin custom components in `src/components/ui/` cover the needed surface (Button, Input/Textarea/Label/Field, Card).

**Tailwind v4**: Uses `@tailwindcss/vite` plugin. No `tailwind.config.js`. All tokens defined in `src/index.css` via `@theme { --color-* }`. This is the v4 pattern, not v3.

**Magic link auth only**: No password flow. Reduces attack surface. Target users are comfortable with email-based auth.

**RLS on all tables**: `industries` and `sources` are readable by `authenticated` role (public catalog). All business tables are scoped via `companies.user_id = auth.uid()`.

**`claim_next_job()` is SECURITY DEFINER**: Only callable by `service_role`. Anon and authenticated roles cannot claim jobs directly. This prevents frontend code from accidentally triggering job execution.

---

## What is NOT yet done (as of initial build)

- [ ] Worker Edge Function deployed to Supabase
- [ ] Secrets set in Supabase Vault (ANTHROPIC_API_KEY, RESEND_API_KEY, FROM_EMAIL)
- [ ] Migration 009 (cron jobs) applied with real project URL and service role key
- [ ] End-to-end test with a real company setup through the live frontend
- [ ] Loom demo recorded
- [ ] LinkedIn launch post scheduled (target: Sunday 11:00 CET)

---

## Language Rules

- UI labels and in-app copy: German
- LinkedIn posts and external-facing text: English
- Code comments: German, brief
- SQL comments: via `COMMENT ON TABLE` and `COMMENT ON COLUMN`
- TypeScript: camelCase. SQL: snake_case
- No em-dashes, no AI-sounding prose in any user-facing copy
