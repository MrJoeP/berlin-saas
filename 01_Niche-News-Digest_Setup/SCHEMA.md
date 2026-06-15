# Datenschema

Foundation für alle 10 Module. Jede Wahl hier wirkt sich auf die nächsten neun Wochen aus.

## TABLES

### users
Default Supabase-Auth. Kein Custom-Field nötig in W1.

### companies
- id (uuid, pk)
- user_id (uuid, fk users)
- name (text)
- url (text)
- tagline (text)
- industry (text)
- niche (text)
- keywords (text array)
- voice_sample (text, optional)
- profile_json (jsonb) — strukturiertes Output vom Scrape-Layer
- created_at (timestamptz)

### competitors
- id (uuid, pk)
- company_id (uuid, fk companies)
- name (text)
- url (text)
- profile_json (jsonb) — Scrape-Result
- created_at (timestamptz)

### industries
- id (uuid, pk)
- name (text, unique)
- description (text)

Vordefinierte Liste. Founder wählt aus oder ergänzt.

### sources
- id (uuid, pk)
- name (text)
- url (text)
- type (enum: rss, newsapi, reddit, hackernews, producthunt, twitter)
- industry_tags (text array)
- config (jsonb) — feed-spezifische Konfiguration

Source-Library als Master-Table. Pro Company filtert die App passende Sources nach Industrie und User-Auswahl.

### company_sources
- company_id (uuid, fk companies)
- source_id (uuid, fk sources)
- active (boolean)
- primary key (company_id, source_id)

### digests
- id (uuid, pk)
- company_id (uuid, fk companies)
- type (enum: niche_news, top_post, competitor, ugc) — bereitet auf W2 bis W5 vor
- title (text)
- generated_at (timestamptz)
- delivered_at (timestamptz, nullable)

### digest_items
- id (uuid, pk)
- digest_id (uuid, fk digests)
- cluster (text)
- title (text)
- summary (text)
- source_url (text)
- source_name (text)
- published_at (timestamptz)
- raw_json (jsonb)
- embedding (vector(1536))

### knowledge_entries
- id (uuid, pk)
- company_id (uuid, fk companies)
- type (text) — generischer Knowledge-Typ für spätere Module
- content (text)
- metadata (jsonb)
- embedding (vector(1536))
- created_at (timestamptz)

Generische Tabelle für die spätere Knowledge-Base. Alle weiteren Module schreiben hier rein und ziehen daraus.

## INDEXES
- companies(user_id)
- competitors(company_id)
- digests(company_id, generated_at desc)
- digest_items(digest_id)
- knowledge_entries(company_id, type)
- ivfflat-Index auf digest_items.embedding
- ivfflat-Index auf knowledge_entries.embedding

## ROW-LEVEL-SECURITY
- companies, competitors, digests, digest_items, knowledge_entries: User sieht nur eigene Datensätze.
- industries, sources: read-only für alle eingeloggten User.

## OFFENE PUNKTE
- Multi-Tenant-Logik (mehrere Personen pro Company) wird erst ab Bedarf eingebaut. In W1 ein User pro Company.
- Voice-Sample-Storage: erstmal als Text-Feld in companies. Wenn später Audio kommt, Supabase Storage anbinden.
