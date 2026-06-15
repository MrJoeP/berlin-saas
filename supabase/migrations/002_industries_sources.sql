-- Migration 002: Industries und Sources Master-Tables
-- Read-only Reference-Tabellen. Founder wählt aus, kann eigene Sources ergänzen.

-- Industries
create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.industries is 'Master-Liste der Industrien. Founder wählt eine aus, Vorschläge für Sources werden danach gefiltert.';

-- Sources
do $$ begin
  create type public.source_type as enum (
    'rss',
    'newsapi',
    'reddit',
    'hackernews',
    'producthunt',
    'twitter',
    'custom'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  type public.source_type not null,
  industry_tags text[] not null default '{}',
  config jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.sources is 'Master-Library aller Quellen. Filterbar nach industry_tags.';
comment on column public.sources.config is 'Source-spezifische Konfiguration. Bei reddit z.B. {"subreddit": "saas"}, bei newsapi {"keywords": ["saas", "b2b"]}.';
comment on column public.sources.is_default is 'true wenn diese Source automatisch vorgeschlagen wird für matchende Industrien.';

create index if not exists idx_sources_type on public.sources(type);
create index if not exists idx_sources_industry_tags on public.sources using gin(industry_tags);

-- Seed: ein paar Default-Industries
insert into public.industries (name, description) values
  ('B2B SaaS', 'Software-as-a-Service for businesses'),
  ('AI Tools', 'AI-powered tools and platforms'),
  ('DevTools', 'Tools for software developers'),
  ('HR Tech', 'Recruiting, hiring, people operations'),
  ('Marketing Tech', 'Marketing automation, analytics, content'),
  ('FinTech', 'Financial technology and services'),
  ('E-Commerce', 'Online retail platforms and tools'),
  ('Productivity', 'Workflow, collaboration, time management')
on conflict (name) do nothing;
