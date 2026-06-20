-- Tier-System für Quellen-Validität.
-- Tier 1 = Primärquellen (Hersteller, offizielle Releases, Press)
-- Tier 2 = Editorial (redaktionell geprüfte Industry-Pubs)
-- Tier 3 = Community (Reddit, HN, Foren — Meinungen, nicht Fakten)

alter table sources add column if not exists tier int not null default 3 check (tier in (1, 2, 3));
alter table sources add column if not exists min_score int default 0;
alter table sources add column if not exists max_age_days int default 7;

comment on column sources.tier is '1=Primärquelle, 2=Editorial, 3=Community';
comment on column sources.min_score is 'Minimum Score (Reddit upvotes, HN points) damit Item durchkommt';
comment on column sources.max_age_days is 'Items älter als X Tage werden gefiltert';

-- Bestehende Sources tieren.
update sources set tier = 2 where name in (
  'Search Engine Journal', 'Marketing Brew', 'Ahrefs Blog', 'Moz Blog',
  'Latent Space', 'SaaStr Blog', 'Indie Hackers', 'Changelog Podcast'
);

update sources set tier = 3, min_score = 100, max_age_days = 7
  where type = 'reddit';

update sources set tier = 3, min_score = 50, max_age_days = 7
  where type = 'hackernews';

update sources set tier = 3, max_age_days = 7
  where type = 'producthunt';
