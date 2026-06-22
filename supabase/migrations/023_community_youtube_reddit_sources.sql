-- Migration 023: Community-Sources ausbauen — YouTube via RSS + mehr Reddit.

-- YouTube-Kanäle für Marketing Tech via RSS.
-- YouTube-RSS-Format: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('YouTube · Ahrefs', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCh_8E6FXvCQGqIzbU4erLOQ', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Backlinko (Brian Dean)', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCk-Yh2cqUNRpJaOg7P4q5pA', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Income School', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCmJB9nT5lyhPxFapSI_kvNQ', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Surfer SEO', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4JqGKVRBJpgIm6wHaoO_2g', 'rss', array['Marketing Tech'], '{"platform":"YouTube"}'::jsonb, 3, 14, true),
  ('YouTube · Lenny Rachitsky', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCdYwzN6e7eyFGfXFNVbVPGw', 'rss', array['B2B SaaS','Marketing Tech','Productivity'], '{"platform":"YouTube"}'::jsonb, 3, 14, true)
on conflict do nothing;

-- Mehr Reddit für Marketing-Communities.
insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('r/contentmarketing', null, 'reddit', array['Marketing Tech'], '{"subreddit":"contentmarketing"}'::jsonb, 3, 50, 7, true),
  ('r/SEOaudits', null, 'reddit', array['Marketing Tech'], '{"subreddit":"SEOaudits"}'::jsonb, 3, 30, 7, true),
  ('r/MarketingResearch', null, 'reddit', array['Marketing Tech'], '{"subreddit":"MarketingResearch"}'::jsonb, 3, 50, 7, true)
on conflict do nothing;

-- Hinweis: LinkedIn und X/Twitter haben keine offenen RSS-Feeds mehr.
-- LinkedIn: nur via Sales-Navigator-API (paid) oder Manual-Scrape (gegen TOS).
-- X/Twitter: API ist paid since 2023, Nitter-Instanzen sind unreliable.
-- Beide Plattformen sind im Frontend als Labels reserviert für künftigen Support.
