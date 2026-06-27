-- Migration 032: Consumer-Tech-Quellen, Apple-Branche und Quellen-Backfill.
-- Grund: Apple hatte industry=null (0 passende Fachquellen), LinkedIn (B2B SaaS)
-- war unvollständig attached. Buzzmatic dient als Template-Qualität.

-- 1. Fachartikel (Niche News): redaktionelle Consumer-Tech-Outlets, KEIN config.platform.
insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('Apple Newsroom', 'https://www.apple.com/newsroom/rss-feed.rss', 'rss', array['Consumer Tech'], '{}'::jsonb, 1, 0, 21, true),
  ('The Verge', 'https://www.theverge.com/rss/index.xml', 'rss', array['Consumer Tech', 'AI Tools'], '{}'::jsonb, 2, 0, 14, true),
  ('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'rss', array['Consumer Tech', 'DevTools'], '{}'::jsonb, 2, 0, 14, true),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'rss', array['Consumer Tech', 'AI Tools', 'B2B SaaS'], '{}'::jsonb, 2, 0, 14, true),
  ('Engadget', 'https://www.engadget.com/rss.xml', 'rss', array['Consumer Tech'], '{}'::jsonb, 2, 0, 14, true),
  ('Wired', 'https://www.wired.com/feed/rss', 'rss', array['Consumer Tech'], '{}'::jsonb, 2, 0, 14, true),
  ('CNET', 'https://www.cnet.com/rss/news/', 'rss', array['Consumer Tech'], '{}'::jsonb, 2, 0, 14, true),
  ('9to5Mac', 'https://9to5mac.com/feed/', 'rss', array['Consumer Tech'], '{}'::jsonb, 2, 0, 14, true),
  ('9to5Google', 'https://9to5google.com/feed/', 'rss', array['Consumer Tech'], '{}'::jsonb, 2, 0, 14, true),
  ('MacRumors', 'https://feeds.macrumors.com/MacRumors-All', 'rss', array['Consumer Tech'], '{}'::jsonb, 3, 0, 14, true),
  ('Daring Fireball', 'https://daringfireball.net/feeds/main', 'rss', array['Consumer Tech'], '{}'::jsonb, 3, 0, 14, true),
  ('Six Colors', 'https://sixcolors.com/feed/', 'rss', array['Consumer Tech'], '{}'::jsonb, 3, 0, 14, true)
on conflict do nothing;

-- 2. Social / Community (Published Content): Reddit + HN + YouTube + X, mit config.platform.
insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('r/apple', null, 'reddit', array['Consumer Tech'], '{"subreddit":"apple","platform":"Reddit"}'::jsonb, 3, 300, 7, true),
  ('r/gadgets', null, 'reddit', array['Consumer Tech'], '{"subreddit":"gadgets","platform":"Reddit"}'::jsonb, 3, 150, 7, true),
  ('r/technology', null, 'reddit', array['Consumer Tech'], '{"subreddit":"technology","platform":"Reddit"}'::jsonb, 3, 500, 7, true),
  ('r/iphone', null, 'reddit', array['Consumer Tech'], '{"subreddit":"iphone","platform":"Reddit"}'::jsonb, 3, 100, 7, true),
  ('r/mac', null, 'reddit', array['Consumer Tech'], '{"subreddit":"mac","platform":"Reddit"}'::jsonb, 3, 50, 7, true),
  ('r/AppleWatch', null, 'reddit', array['Consumer Tech'], '{"subreddit":"AppleWatch","platform":"Reddit"}'::jsonb, 3, 30, 7, true)
on conflict do nothing;

insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('Hacker News · Consumer Tech', null, 'hackernews', array['Consumer Tech'], '{"query":"apple iphone ipad macos ios","platform":"Hacker News"}'::jsonb, 2, 50, 7, true)
on conflict do nothing;

insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('YouTube · MKBHD', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ', 'rss', array['Consumer Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · The Verge', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCddiUEpeqJcYeBxX1IVBKvQ', 'rss', array['Consumer Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('X · @markgurman', 'https://rsshub.app/twitter/user/markgurman', 'rss', array['Consumer Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @verge', 'https://rsshub.app/twitter/user/verge', 'rss', array['Consumer Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true)
on conflict do nothing;

-- 3. Apple bekommt eine Branche (vorher null → keine passenden Quellen).
update companies
set industry = 'Consumer Tech'
where (url ilike '%apple.com%' or name ilike 'Apple%')
  and industry is null;

-- 4. Backfill: jede Company bekommt alle default-Quellen, deren industry_tags zur Branche passen.
--    Fixt LinkedIns dünnes B2B-SaaS-Set und attached Apples neue Consumer-Tech-Quellen.
--    NOT EXISTS schützt bestehende (auch deaktivierte) Verknüpfungen.
insert into company_sources (company_id, source_id, active)
select c.id, s.id, true
from companies c
join sources s on c.industry = any(s.industry_tags)
where s.is_default = true
  and not exists (
    select 1 from company_sources cs
    where cs.company_id = c.id and cs.source_id = s.id
  );
