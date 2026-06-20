-- Migration 020: Upvotes pro Digest-Item.
-- Basis für späteren Ranking-Algorithmus der präzise/wichtige Beiträge hochzieht.
-- Algorithmus-Idee: Items mit hohen Upvotes → Source-Weight steigt → ähnliche Items
-- in Folge-Wochen werden priorisiert.

alter table digest_items add column if not exists upvotes int not null default 0;
create index if not exists idx_digest_items_upvotes on digest_items(upvotes desc);

comment on column digest_items.upvotes is 'User-Bewertung pro Item. Algorithmus nutzt diese für künftiges Source-Weighting.';
