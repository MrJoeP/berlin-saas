-- Migration 003: Companies und Competitors
-- Founder-Profile plus Konkurrenten. Eine Company pro User in W1.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text,
  tagline text,
  industry text,
  niche text,
  keywords text[] not null default '{}',
  voice_sample text,
  profile_json jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_companies_user on public.companies(user_id);

comment on table public.companies is 'Founder-Companies. Eine Company pro User in W1.';
comment on column public.companies.profile_json is 'Strukturiertes Profile vom Scrape-Layer (USPs, Tagline, etc.).';
comment on column public.companies.active is 'Wenn true, läuft der wöchentliche Schedule für diese Company.';

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  url text,
  profile_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_competitors_company on public.competitors(company_id);

comment on table public.competitors is 'Konkurrenten einer Company. Werden vom Scrape-Layer befüllt.';
