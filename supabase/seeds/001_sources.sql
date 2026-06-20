-- Seed-Daten für die Source-Library.
-- Wurde bei Initial-Setup über `apply_migration` angewendet, hier als File für Reproduzierbarkeit.

insert into public.sources (name, url, type, industry_tags, config, is_default) values
  -- B2B SaaS
  ('SaaStr Blog', 'https://www.saastr.com/feed/', 'rss', ARRAY['B2B SaaS'], '{}', true),
  ('Indie Hackers', 'https://www.indiehackers.com/posts.rss', 'rss', ARRAY['B2B SaaS', 'Productivity'], '{}', true),
  ('r/SaaS', null, 'reddit', ARRAY['B2B SaaS'], '{"subreddit": "SaaS"}', true),
  ('r/startups', null, 'reddit', ARRAY['B2B SaaS', 'AI Tools', 'DevTools'], '{"subreddit": "startups"}', true),
  ('HN SaaS Stories', null, 'hackernews', ARRAY['B2B SaaS'], '{"query": "saas", "min_score": 50}', false),

  -- AI Tools
  ('r/AI_Agents', null, 'reddit', ARRAY['AI Tools'], '{"subreddit": "AI_Agents"}', true),
  ('r/LocalLLaMA', null, 'reddit', ARRAY['AI Tools'], '{"subreddit": "LocalLLaMA"}', true),
  ('HN AI Stories', null, 'hackernews', ARRAY['AI Tools'], '{"query": "ai", "min_score": 100}', true),
  ('Latent Space', 'https://www.latent.space/feed', 'rss', ARRAY['AI Tools'], '{}', true),

  -- DevTools
  ('r/programming', null, 'reddit', ARRAY['DevTools'], '{"subreddit": "programming"}', true),
  ('Changelog Podcast', 'https://changelog.com/feed', 'rss', ARRAY['DevTools'], '{}', false),
  ('HN Dev Stories', null, 'hackernews', ARRAY['DevTools'], '{"query": "developer tools", "min_score": 80}', true),

  -- HR Tech
  ('r/humanresources', null, 'reddit', ARRAY['HR Tech'], '{"subreddit": "humanresources"}', true),
  ('r/recruiting', null, 'reddit', ARRAY['HR Tech'], '{"subreddit": "recruiting"}', true),

  -- Marketing Tech
  ('r/marketing', null, 'reddit', ARRAY['Marketing Tech'], '{"subreddit": "marketing"}', true),
  ('r/SEO', null, 'reddit', ARRAY['Marketing Tech'], '{"subreddit": "SEO"}', false),

  -- FinTech
  ('r/fintech', null, 'reddit', ARRAY['FinTech'], '{"subreddit": "fintech"}', true),
  ('HN FinTech', null, 'hackernews', ARRAY['FinTech'], '{"query": "fintech", "min_score": 50}', true),

  -- E-Commerce
  ('r/ecommerce', null, 'reddit', ARRAY['E-Commerce'], '{"subreddit": "ecommerce"}', true),
  ('r/shopify', null, 'reddit', ARRAY['E-Commerce'], '{"subreddit": "shopify"}', true),

  -- Productivity
  ('r/productivity', null, 'reddit', ARRAY['Productivity'], '{"subreddit": "productivity"}', true),
  ('r/notion', null, 'reddit', ARRAY['Productivity'], '{"subreddit": "notion"}', false);
