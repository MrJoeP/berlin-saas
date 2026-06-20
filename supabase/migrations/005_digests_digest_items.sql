-- Migration 005: Digests und Digest-Items
-- Container plus Items. type unterscheidet welcher Bot den Digest produziert hat.

do $$ begin
  create type public.digest_type as enum (
    'niche_news',
    'top_post',
    'competitor',
    'ugc'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.digests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type public.digest_type not null,
  title text not null,
  generated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_digests_company_generated on public.digests(company_id, generated_at desc);

comment on table public.digests is 'Container pro Digest-Lauf. type bestimmt welcher Bot ihn produziert hat.';

create table if not exists public.digest_items (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  cluster text,
  title text,
  summary text,
  source_url text,
  source_name text,
  published_at timestamptz,
  raw_json jsonb not null default '{}',
  embedding vector(1536)
);

create index if not exists idx_digest_items_digest on public.digest_items(digest_id);
create index if not exists idx_digest_items_embedding on public.digest_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table public.digest_items is 'Items innerhalb eines Digests, gegliedert nach cluster.';
