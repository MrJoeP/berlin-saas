-- Tier-Info pro Digest-Item + Cluster-Confidence-Label.
alter table digest_items add column if not exists source_tier int check (source_tier in (1, 2, 3));
alter table digest_items add column if not exists cluster_confidence text check (cluster_confidence in ('verified', 'editorial', 'community'));

comment on column digest_items.source_tier is '1=Primärquelle, 2=Editorial, 3=Community';
comment on column digest_items.cluster_confidence is 'verified=mind. 1 T1-Quelle, editorial=mind. 2 T2-Quellen, community=nur T3';
