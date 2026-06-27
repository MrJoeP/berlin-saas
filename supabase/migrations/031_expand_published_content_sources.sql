-- Migration 031: Published-Content-Quellen ausweiten.
-- Fokus: Social/Community/Discussion statt Fachartikel.

insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('Hacker News · SaaS', null, 'hackernews', array['B2B SaaS', 'AI Tools', 'DevTools', 'Productivity'], '{"query":"saas startup b2b","platform":"Hacker News"}'::jsonb, 2, 30, 7, true),
  ('Hacker News · AI Tools', null, 'hackernews', array['AI Tools', 'DevTools', 'Productivity'], '{"query":"ai tools agents llm","platform":"Hacker News"}'::jsonb, 2, 30, 7, true),
  ('Hacker News · Growth', null, 'hackernews', array['Marketing Tech', 'B2B SaaS'], '{"query":"growth marketing seo content","platform":"Hacker News"}'::jsonb, 2, 30, 7, true),
  ('Product Hunt · Launches', null, 'producthunt', array['B2B SaaS', 'AI Tools', 'DevTools', 'Marketing Tech', 'Productivity'], '{"platform":"Product Hunt"}'::jsonb, 2, 0, 7, true)
on conflict do nothing;

insert into sources (name, url, type, industry_tags, config, tier, min_score, max_age_days, is_default) values
  ('r/SaaS', null, 'reddit', array['B2B SaaS'], '{"subreddit":"SaaS","platform":"Reddit"}'::jsonb, 3, 20, 7, true),
  ('r/startups', null, 'reddit', array['B2B SaaS', 'AI Tools', 'Productivity'], '{"subreddit":"startups","platform":"Reddit"}'::jsonb, 3, 50, 7, true),
  ('r/Entrepreneur', null, 'reddit', array['B2B SaaS', 'Marketing Tech'], '{"subreddit":"Entrepreneur","platform":"Reddit"}'::jsonb, 3, 100, 7, true),
  ('r/artificial', null, 'reddit', array['AI Tools'], '{"subreddit":"artificial","platform":"Reddit"}'::jsonb, 3, 50, 7, true),
  ('r/MachineLearning', null, 'reddit', array['AI Tools', 'DevTools'], '{"subreddit":"MachineLearning","platform":"Reddit"}'::jsonb, 3, 100, 7, true),
  ('r/webdev', null, 'reddit', array['DevTools', 'B2B SaaS'], '{"subreddit":"webdev","platform":"Reddit"}'::jsonb, 3, 80, 7, true)
on conflict do nothing;

insert into sources (name, url, type, industry_tags, config, tier, max_age_days, is_default) values
  ('X · @ycombinator', 'https://rsshub.app/twitter/user/ycombinator', 'rss', array['B2B SaaS', 'AI Tools'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @ProductHunt', 'https://rsshub.app/twitter/user/ProductHunt', 'rss', array['B2B SaaS', 'AI Tools', 'DevTools', 'Marketing Tech', 'Productivity'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('X · @OpenAI', 'https://rsshub.app/twitter/user/OpenAI', 'rss', array['AI Tools', 'DevTools'], '{"platform":"Twitter/X"}'::jsonb, 3, 7, true),
  ('LinkedIn · #saas', 'https://rsshub.app/linkedin/hashtag/saas', 'rss', array['B2B SaaS'], '{"platform":"LinkedIn"}'::jsonb, 3, 7, true),
  ('LinkedIn · #artificialintelligence', 'https://rsshub.app/linkedin/hashtag/artificialintelligence', 'rss', array['AI Tools'], '{"platform":"LinkedIn"}'::jsonb, 3, 7, true),
  ('LinkedIn · #startups', 'https://rsshub.app/linkedin/hashtag/startups', 'rss', array['B2B SaaS', 'AI Tools'], '{"platform":"LinkedIn"}'::jsonb, 3, 7, true)
on conflict do nothing;

insert into company_sources (company_id, source_id, active)
select c.id, s.id, true
from companies c
join sources s on (
  c.industry = any(s.industry_tags)
  or (
    c.industry is null
    and s.type in ('reddit', 'hackernews', 'producthunt')
  )
)
where s.is_default = true
  and (
    s.type in ('reddit', 'hackernews', 'producthunt', 'twitter')
    or s.config->>'platform' in ('YouTube', 'Twitter/X', 'LinkedIn', 'Hacker News', 'Product Hunt', 'Reddit')
  )
  and not exists (
    select 1
    from company_sources cs
    where cs.company_id = c.id
      and cs.source_id = s.id
  );
