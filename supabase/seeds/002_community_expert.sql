-- Seed 002: Community-Expert-Layer
-- Fachmeinung statt Reddit-Rauschen. Drei Kanäle, alle live verifiziert (200 + echtes XML):
--   Lobsters      — invite-only, Praktiker, sehr hohes Signal. Tag-Feeds.
--   Dev.to        — Practitioner-Posts pro Tag, hohe Frequenz.
--   Stack Exchange— Experten-Q&A. /feeds gibt die aktuell heißesten Fragen einer Site.
--                   Was dort oben steht, ist das woran Fachleute gerade wirklich arbeiten.
--
-- WARUM NICHT mehr Reddit: aus dem Supabase-Datacenter gibt Reddit zuverlässig 429/403
-- (unauthentifiziert, Bot-geflaggt). Lokal sequenziell mit Pause schon getestet: weiter 429.
-- Diese drei Kanäle haben im selben Test sauber durchgeliefert, ohne Rate-Limit.
--
-- Tier-Logik: bleibt 3 (Community), aber das ist das obere Ende davon. Der Keyword-Filter
-- im Scraper (T3 muss matchen) hält die Tag-Streams branchenrelevant.
-- DEPENDENCY: Migration 011_sources_tier_columns.sql. Tier/Age stehen zusätzlich in config.

insert into public.sources (name, url, type, industry_tags, config, is_default) values


-- ═══════════════════════════════════════════════════════════════════════
-- AI Tools
-- ═══════════════════════════════════════════════════════════════════════
('Lobsters — AI',            'https://lobste.rs/t/ai.rss',                  'rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":7}', true),
('Lobsters — ML',            'https://lobste.rs/t/ml.rss',                  'rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":7}', true),
('Dev.to — AI',              'https://dev.to/feed/tag/ai',                  'rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":5}', true),
('Dev.to — Machine Learning','https://dev.to/feed/tag/machinelearning',     'rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":5}', false),
('StackExchange — AI',       'https://ai.stackexchange.com/feeds',          'rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":7}', true),
('StackExchange — Data Science','https://datascience.stackexchange.com/feeds','rss', ARRAY['AI Tools'], '{"tier":3,"max_age_days":7}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- DevTools
-- ═══════════════════════════════════════════════════════════════════════
('Lobsters — Programming',   'https://lobste.rs/t/programming.rss',         'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":7}', true),
('Lobsters — DevOps',        'https://lobste.rs/t/devops.rss',              'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":7}', true),
('Lobsters — Distributed',   'https://lobste.rs/t/distributed.rss',         'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":14}', false),
('Lobsters — Databases',     'https://lobste.rs/t/databases.rss',           'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":14}', false),
('Lobsters — Security',      'https://lobste.rs/t/security.rss',            'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":7}', true),
('Lobsters — Web',           'https://lobste.rs/t/web.rss',                 'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":7}', false),
('Lobsters — Rust',          'https://lobste.rs/t/rust.rss',                'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":14}', false),
('Lobsters — Python',        'https://lobste.rs/t/python.rss',              'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":14}', false),
('Lobsters — Practices',     'https://lobste.rs/t/practices.rss',           'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":14}', true),
('Dev.to — DevOps',          'https://dev.to/feed/tag/devops',              'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":5}', false),
('Dev.to — WebDev',          'https://dev.to/feed/tag/webdev',              'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":5}', false),
('StackExchange — DevOps',   'https://devops.stackexchange.com/feeds',      'rss', ARRAY['DevTools'], '{"tier":3,"max_age_days":7}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- B2B SaaS
-- ═══════════════════════════════════════════════════════════════════════
('Dev.to — SaaS',            'https://dev.to/feed/tag/saas',                'rss', ARRAY['B2B SaaS'], '{"tier":3,"max_age_days":7}', true),
('Dev.to — Startup',         'https://dev.to/feed/tag/startup',             'rss', ARRAY['B2B SaaS'], '{"tier":3,"max_age_days":7}', true),
('HN — Show HN (Launches)',  'https://hnrss.org/show',                      'rss', ARRAY['B2B SaaS'], '{"tier":3,"max_age_days":7}', true),
('HN — Ask HN',              'https://hnrss.org/ask',                       'rss', ARRAY['B2B SaaS','Productivity'], '{"tier":3,"max_age_days":7}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- HR Tech
-- ═══════════════════════════════════════════════════════════════════════
('StackExchange — Workplace','https://workplace.stackexchange.com/feeds',   'rss', ARRAY['HR Tech'], '{"tier":3,"max_age_days":7}', true),
('Dev.to — Career',          'https://dev.to/feed/tag/career',              'rss', ARRAY['HR Tech'], '{"tier":3,"max_age_days":7}', true),
('Lobsters — Culture',       'https://lobste.rs/t/culture.rss',             'rss', ARRAY['HR Tech','Productivity'], '{"tier":3,"max_age_days":14}', false),
('HN — Recruiting/Hiring',   'https://hnrss.org/newest?q=recruiting+hiring&points=30','rss', ARRAY['HR Tech'], '{"tier":3,"max_age_days":7}', true),


-- ═══════════════════════════════════════════════════════════════════════
-- Marketing Tech
-- ═══════════════════════════════════════════════════════════════════════
('Dev.to — Marketing',       'https://dev.to/feed/tag/marketing',           'rss', ARRAY['Marketing Tech'], '{"tier":3,"max_age_days":7}', true),
('Dev.to — SEO',             'https://dev.to/feed/tag/seo',                 'rss', ARRAY['Marketing Tech'], '{"tier":3,"max_age_days":7}', true),
('StackExchange — Webmasters','https://webmasters.stackexchange.com/feeds',  'rss', ARRAY['Marketing Tech'], '{"tier":3,"max_age_days":7}', false),
('StackExchange — UX',       'https://ux.stackexchange.com/feeds',          'rss', ARRAY['Marketing Tech','Productivity'], '{"tier":3,"max_age_days":7}', true),
('HN — Marketing/SEO',       'https://hnrss.org/newest?q=marketing+seo&points=40','rss', ARRAY['Marketing Tech'], '{"tier":3,"max_age_days":7}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- FinTech
-- ═══════════════════════════════════════════════════════════════════════
('Lobsters — Finance',       'https://lobste.rs/t/finance.rss',             'rss', ARRAY['FinTech'], '{"tier":3,"max_age_days":14}', true),
('Dev.to — FinTech',         'https://dev.to/feed/tag/fintech',             'rss', ARRAY['FinTech'], '{"tier":3,"max_age_days":7}', true),
('StackExchange — Money',    'https://money.stackexchange.com/feeds',       'rss', ARRAY['FinTech'], '{"tier":3,"max_age_days":7}', false),
('HN — Payments/Banking',    'https://hnrss.org/newest?q=payments+banking&points=40','rss', ARRAY['FinTech'], '{"tier":3,"max_age_days":7}', true),


-- ═══════════════════════════════════════════════════════════════════════
-- E-Commerce
-- ═══════════════════════════════════════════════════════════════════════
('Dev.to — E-Commerce',      'https://dev.to/feed/tag/ecommerce',           'rss', ARRAY['E-Commerce'], '{"tier":3,"max_age_days":7}', true),
('HN — E-Commerce',          'https://hnrss.org/newest?q=ecommerce&points=40','rss', ARRAY['E-Commerce'], '{"tier":3,"max_age_days":7}', true),
('HN — Shopify/DTC',         'https://hnrss.org/newest?q=shopify+dtc&points=30','rss', ARRAY['E-Commerce'], '{"tier":3,"max_age_days":7}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- Productivity
-- ═══════════════════════════════════════════════════════════════════════
('Dev.to — Productivity',    'https://dev.to/feed/tag/productivity',        'rss', ARRAY['Productivity'], '{"tier":3,"max_age_days":7}', true),
('HN — Tools for Thought',   'https://hnrss.org/newest?q=note-taking+knowledge+management&points=50','rss', ARRAY['Productivity'], '{"tier":3,"max_age_days":14}', true);
