-- Migration 006: Knowledge-Entries
-- Generische Knowledge-Base für alle 10 Module. type unterscheidet semantic.

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_entries_company_type on public.knowledge_entries(company_id, type);
create index if not exists idx_knowledge_entries_embedding on public.knowledge_entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table public.knowledge_entries is 'Generische Knowledge-Base für alle 10 Module. type unterscheidet semantic, z.B. brand_voice, customer_quote, competitor_messaging, etc.';
