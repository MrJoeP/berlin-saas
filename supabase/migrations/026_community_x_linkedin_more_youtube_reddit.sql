-- Migration 026: Community-Sources weiter ausbauen.
-- X/Twitter und LinkedIn via RSSHub (kostenloser community RSS-Service).
-- Reliability-Hinweis: RSSHub-Public-Instance kann rate-limited oder offline sein.
-- Falls Plattformen leer bleiben: in scrape-news Logs schauen.

-- Mehr YouTube-Kanäle
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('YouTube · Neil Patel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCl-Zrl0QhF66lu1aGXaTbfw', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Moz', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCs26XZBwrSZLiTEH8wcoVXw', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Semrush', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCDi2N2J91eqCnvk0nhBCo3w', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Search Engine Journal', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5xYDqgFhxwHJrtfFAOgwJg', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true)
on conflict do nothing;

-- X/Twitter via RSSHub
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('X · @backlinko', 'https://rsshub.app/twitter/user/backlinko', 'rss', array['Marketing Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @sengineland', 'https://rsshub.app/twitter/user/sengineland', 'rss', array['Marketing Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @lennysan', 'https://rsshub.app/twitter/user/lennysan', 'rss', array['B2B SaaS','Marketing Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @neilpatel', 'https://rsshub.app/twitter/user/neilpatel', 'rss', array['Marketing Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @randfish', 'https://rsshub.app/twitter/user/randfish', 'rss', array['Marketing Tech'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true)
on conflict do nothing;

-- LinkedIn via RSSHub (Hashtag-Feeds)
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('LinkedIn · #marketing', 'https://rsshub.app/linkedin/hashtag/marketing', 'rss', array['Marketing Tech'], '{"platform":"LinkedIn"}'::jsonb, 3, 7, true),
  ('LinkedIn · #seo', 'https://rsshub.app/linkedin/hashtag/seo', 'rss', array['Marketing Tech'], '{"platform":"LinkedIn"}'::jsonb, 3, 7, true)
on conflict do nothing;

-- Mehr Reddit-Subs
insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('r/InternetMarketing', null, 'reddit', array['Marketing Tech'], '{"subreddit":"InternetMarketing"}'::jsonb, 3, 30, 7, true),
  ('r/Marketing_Strategies', null, 'reddit', array['Marketing Tech'], '{"subreddit":"Marketing_Strategies"}'::jsonb, 3, 30, 7, true),
  ('r/AdvertisingAgency', null, 'reddit', array['Marketing Tech'], '{"subreddit":"AdvertisingAgency"}'::jsonb, 3, 20, 7, true)
on conflict do nothing;

-- Auto-attach an alle existierenden Marketing-Tech Companies.
insert into company_sources (company_id, source_id, active)
select c.id, s.id, true
from companies c
cross join sources s
where 'Marketing Tech' = any(s.industry_tags)
  and s.is_default = true
  and (s.config->>'platform' in ('YouTube', 'Twitter/X', 'LinkedIn') or s.type = 'reddit')
  and not exists (select 1 from company_sources where company_id = c.id and source_id = s.id);
