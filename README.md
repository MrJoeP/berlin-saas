# Berlin SaaS

10 Wochen, 10 AI-Tools für junge Founder. Build-in-Public.

## ORIENTIERUNG
- [GENERAL_CONSTRUCT.md](GENERAL_CONSTRUCT.md): Rahmen für alle Projekte. Rolle, Ziele, Schreibweise, Filter.
- [10_WEEKS_ROADMAP.md](10_WEEKS_ROADMAP.md): Wochen-Plan mit Status pro Modul.

## STRUKTUR
- `01_Niche-News-Digest_Setup/` und folgende: Specs und Notes pro Modul.
- `supabase/`: geteilte Datenbank-Migrations und Edge Functions für alle Module.
- `prompts/`: geteilte LLM-Prompts.

## STACK
- Frontend: Lovable.
- Backend, DB, Auth, Cron: Supabase mit pgvector.
- LLM: Claude API (Sonnet 4.6, Haiku 4.5).
- Build-Assistance: Claude Code.
- Email: Resend.

## LOKAL ARBEITEN
```bash
# Supabase CLI installieren
brew install supabase/tap/supabase

# Repo klonen
git clone <repo-url>
cd berlin-saas

# Supabase mit Projekt verbinden
supabase link --project-ref <project-ref>

# Migrations deployen
supabase db push
```

## FILTER VOR JEDEM BAU
1. Buzzmatic-Filter: Würde Buzzmatic das selbst bauen? Wenn ja, raus.
2. Agentur-Filter: Verkaufbar später, intern nutzbar, oder beides? Wenn keins, schwach.
