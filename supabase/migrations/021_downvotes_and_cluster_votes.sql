-- Downvote pro Item.
alter table digest_items add column if not exists downvotes int not null default 0;
create index if not exists idx_digest_items_score on digest_items((upvotes - downvotes) desc);
comment on column digest_items.downvotes is 'Downvotes pro Item. Algorithmus nutzt (upvotes - downvotes) als Item-Score.';

-- Votes auf ganzen Cluster (Thema): eigene Tabelle mit composite key.
-- Lazy-created auf erstem Vote via upsert on conflict.
create table if not exists public.digest_cluster_votes (
  digest_id uuid not null references public.digests(id) on delete cascade,
  cluster_name text not null,
  upvotes int not null default 0,
  downvotes int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (digest_id, cluster_name)
);
create index if not exists idx_cluster_votes_score on digest_cluster_votes((upvotes - downvotes) desc);

alter table digest_cluster_votes enable row level security;
create policy "open_all" on digest_cluster_votes for all using (true) with check (true);

comment on table digest_cluster_votes is 'Up/Downvote-Counter pro Thema/Cluster. Lazy-created auf erstem Vote.';
