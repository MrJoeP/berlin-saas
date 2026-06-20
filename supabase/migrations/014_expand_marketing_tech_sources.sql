-- Source-Pool für Marketing Tech ausbauen: T1 + T2 + zusätzliche T3.
-- T1 Primärquellen (Hersteller, Plattformen)
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('Google Search Central Blog', 'https://developers.google.com/search/blog/rss/feed.xml', 'rss', array['Marketing Tech', 'DevTools'], '{}'::jsonb, 1, 30, true),
  ('OpenAI Blog', 'https://openai.com/blog/rss.xml', 'rss', array['AI Tools', 'Marketing Tech'], '{}'::jsonb, 1, 30, true),
  ('Anthropic News', 'https://www.anthropic.com/news/rss.xml', 'rss', array['AI Tools', 'Marketing Tech'], '{}'::jsonb, 1, 30, true),
  ('Microsoft Bing Webmaster Blog', 'https://blogs.bing.com/webmaster/feed', 'rss', array['Marketing Tech'], '{}'::jsonb, 1, 30, true)
on conflict do nothing;

-- T2 Editorial (Industry-Pubs)
insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('Search Engine Land', 'https://searchengineland.com/feed', 'rss', array['Marketing Tech'], '{}'::jsonb, 2, 14, true),
  ('Semrush Blog', 'https://www.semrush.com/blog/feed/', 'rss', array['Marketing Tech'], '{}'::jsonb, 2, 14, true),
  ('Content Marketing Institute', 'https://contentmarketinginstitute.com/feed/', 'rss', array['Marketing Tech'], '{}'::jsonb, 2, 14, true),
  ('t3n Marketing', 'https://t3n.de/tag/marketing/rss.xml', 'rss', array['Marketing Tech', 'B2B SaaS'], '{}'::jsonb, 2, 14, true),
  ('OnlineMarketing.de', 'https://onlinemarketing.de/feed', 'rss', array['Marketing Tech'], '{}'::jsonb, 2, 14, true),
  ('Backlinko Blog', 'https://backlinko.com/blog/feed', 'rss', array['Marketing Tech'], '{}'::jsonb, 2, 14, true)
on conflict do nothing;

-- T3 zusätzliche Communities mit höheren Score-Thresholds
insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('r/bigseo', null, 'reddit', array['Marketing Tech'], '{"subreddit":"bigseo"}'::jsonb, 3, 50, 7, true),
  ('r/PPC', null, 'reddit', array['Marketing Tech'], '{"subreddit":"PPC"}'::jsonb, 3, 50, 7, true),
  ('r/digital_marketing', null, 'reddit', array['Marketing Tech'], '{"subreddit":"digital_marketing"}'::jsonb, 3, 100, 7, true)
on conflict do nothing;
