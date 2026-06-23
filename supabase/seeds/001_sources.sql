-- Seed-Daten: Source-Library
-- Tier 1 = Primärquelle / Analyst / Insider-Newsletter (hohes Signal, niedriger Output)
-- Tier 2 = Redaktionelle Industry-Pubs (verlässlich, moderate Breite)
-- Tier 3 = Community / Aggregator (hohes Volumen, harter Score-Filter nötig)
-- DEPENDENCY: Migration 011_sources_tier_columns.sql muss zuerst laufen.
-- Tier/min_score/max_age_days stehen zusätzlich in config bis Columns existieren.

insert into public.sources (name, url, type, industry_tags, config, is_default) values


-- ═══════════════════════════════════════════════════════════════════════
-- B2B SaaS  (26 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Operator, Analyst, VC-Insider
('ChartMogul Blog',           'https://chartmogul.com/blog/feed/',                           'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":21}', true),
('OpenView Partners',          'https://openviewpartners.com/blog/feed/',                      'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":30}', true),
('Lenny''s Newsletter',        'https://www.lennysnewsletter.com/feed',                        'rss', ARRAY['B2B SaaS','Productivity'], '{"tier":1,"max_age_days":21}', true),
('Growth Unhinged — Poyar',    'https://www.growthunhinged.com/feed',                          'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":30}', true),
('A Smart Bear — Jason Cohen', 'https://longform.asmartbear.com/rss/',                         'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":60}', true),
('Tomasz Tunguz',              'https://tomtunguz.com/index.xml',                              'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":30}', true),
('First Round Review',         'https://review.firstround.com/rss.xml',                        'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":60}', true),
('Bessemer VP Blog',           'https://www.bvp.com/feeds/blog',                               'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":30}', true),
('Baremetrics Recur',          'https://baremetrics.com/blog/feed',                            'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":21}', true),
('Rob Walling — Stacking Bricks','https://robwalling.com/feed/',                               'rss', ARRAY['B2B SaaS'], '{"tier":1,"max_age_days":30}', false),

-- Tier 2 — Redaktionell, Plattform-Blogs
('SaaStr Blog',                'https://www.saastr.com/feed/',                                 'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":14}', true),
('ProductLed Blog',            'https://productled.com/blog/feed/',                            'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":21}', true),
('Gainsight Blog',             'https://www.gainsight.com/blog/feed/',                         'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":21}', false),
('Intercom Blog',              'https://www.intercom.com/blog/feed/',                          'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":14}', true),
('Amplitude Blog',             'https://amplitude.com/blog/feed',                              'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":21}', false),
('G2 Learn Hub',               'https://learn.g2.com/feed',                                    'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":14}', true),
('ChurnZero Blog',             'https://churnzero.com/blog/feed/',                             'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":30}', false),
('YC Blog',                    'https://www.ycombinator.com/blog/rss',                         'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":30}', true),
('SaaS Mag',                   'https://saasmag.com/feed/',                                    'rss', ARRAY['B2B SaaS'], '{"tier":2,"max_age_days":14}', false),
('Indie Hackers',              'https://www.indiehackers.com/posts.rss',                       'rss', ARRAY['B2B SaaS','Productivity'], '{"tier":2,"max_age_days":7}', true),

-- Tier 3 — Community
('HN — SaaS',                  null, 'hackernews', ARRAY['B2B SaaS'], '{"tier":3,"query":"saas b2b startup revenue","min_score":100}', true),
('r/SaaS',                     null, 'reddit',     ARRAY['B2B SaaS'], '{"tier":3,"subreddit":"SaaS","min_score":60}', true),
('r/microsaas',                null, 'reddit',     ARRAY['B2B SaaS'], '{"tier":3,"subreddit":"microsaas","min_score":30}', true),
('r/startups',                 null, 'reddit',     ARRAY['B2B SaaS'], '{"tier":3,"subreddit":"startups","min_score":80}', false),
('Product Hunt — B2B',         null, 'producthunt',ARRAY['B2B SaaS'], '{"tier":3,"topic":"saas"}', true),
('HN — Pricing',               null, 'hackernews', ARRAY['B2B SaaS'], '{"tier":3,"query":"pricing subscription monetization","min_score":80}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- AI Tools  (28 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Research-nah, Practitioner-Level
('Simon Willison',             'https://simonwillison.net/atom/entries/',                      'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":7}', true),
('Latent Space',               'https://www.latent.space/feed',                                'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":14}', true),
('Import AI — Jack Clark',     'https://jack-clark.net/feed/',                                 'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":14}', true),
('Interconnects — Lambert',    'https://www.interconnects.ai/feed',                            'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":14}', true),
('Eugene Yan',                 'https://eugeneyan.com/feed.xml',                               'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":30}', true),
('Ahead of AI — Raschka',      'https://magazine.sebastianraschka.com/feed',                   'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":21}', true),
('AI Snake Oil — Princeton',   'https://aisnakeoil.substack.com/feed',                         'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":21}', true),
('Andrej Karpathy Blog',       'https://karpathy.github.io/feed.xml',                          'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":60}', true),
('Anthropic Blog',             'https://www.anthropic.com/rss.xml',                            'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":30}', true),
('OpenAI Blog',                'https://openai.com/blog/rss.xml',                              'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":14}', true),
('Google DeepMind Blog',       'https://deepmind.google/blog/rss.xml',                         'rss', ARRAY['AI Tools'], '{"tier":1,"max_age_days":21}', true),

-- Tier 2 — Kuratiert, breite Editorial
('The Batch — deeplearning.ai','https://www.deeplearning.ai/the-batch/feed/',                  'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":14}', true),
('The Gradient — Stanford',    'https://thegradient.pub/rss/',                                 'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":30}', true),
('Hugging Face Blog',          'https://huggingface.co/blog/feed.xml',                         'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":14}', true),
('MIT Tech Review — AI',       'https://www.technologyreview.com/topic/artificial-intelligence/feed','rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":7}', true),
('Weights & Biases Blog',      'https://wandb.ai/fully-connected/rss.xml',                     'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":21}', false),
('VentureBeat AI',             'https://venturebeat.com/category/ai/feed/',                    'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":7}', true),
('AI Business',                'https://aibusiness.com/feed',                                  'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":7}', false),
('KDnuggets',                  'https://www.kdnuggets.com/feed',                               'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":7}', false),
('Last Week in AI',            'https://lastweekin.ai/feed',                                   'rss', ARRAY['AI Tools'], '{"tier":2,"max_age_days":14}', true),

-- Tier 3 — Community
('HN — AI/LLM',                null, 'hackernews', ARRAY['AI Tools'], '{"tier":3,"query":"llm agent ai model","min_score":150}', true),
('r/LocalLLaMA',               null, 'reddit',     ARRAY['AI Tools'], '{"tier":3,"subreddit":"LocalLLaMA","min_score":100}', true),
('r/MachineLearning',          null, 'reddit',     ARRAY['AI Tools'], '{"tier":3,"subreddit":"MachineLearning","min_score":200}', true),
('r/artificial',               null, 'reddit',     ARRAY['AI Tools'], '{"tier":3,"subreddit":"artificial","min_score":80}', false),
('r/ChatGPT',                  null, 'reddit',     ARRAY['AI Tools'], '{"tier":3,"subreddit":"ChatGPT","min_score":150}', false),
('r/singularity',              null, 'reddit',     ARRAY['AI Tools'], '{"tier":3,"subreddit":"singularity","min_score":100}', false),
('Product Hunt — AI',          null, 'producthunt',ARRAY['AI Tools'], '{"tier":3,"topic":"artificial-intelligence"}', true),
('HN — AI Tools',              null, 'hackernews', ARRAY['AI Tools'], '{"tier":3,"query":"ai tool product launch wrapper","min_score":80}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- DevTools  (27 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Tief, Operator-Perspektive
('The Pragmatic Engineer',     'https://newsletter.pragmaticengineer.com/feed',                'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":14}', true),
('Martin Fowler',              'https://martinfowler.com/feed.atom',                           'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":30}', true),
('GitHub Blog',                'https://github.blog/feed/',                                    'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":7}', true),
('The ReadME Project',         'https://github.com/readme/feed.xml',                           'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":14}', true),
('Stripe Engineering',         'https://stripe.com/blog/engineering-feed.rss',                 'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":30}', true),
('Cloudflare Blog',            'https://blog.cloudflare.com/rss/',                             'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":14}', true),
('Dan Luu Blog',               'https://danluu.com/atom.xml',                                  'rss', ARRAY['DevTools'], '{"tier":1,"max_age_days":60}', false),

-- Tier 2 — Redaktionell, Plattform-Blogs
('Changelog News',             'https://changelog.com/news.rss',                               'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":7}', true),
('InfoQ',                      'https://feed.infoq.com/',                                      'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":7}', true),
('Stack Overflow Blog',        'https://stackoverflow.blog/feed/',                              'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', true),
('The New Stack',              'https://thenewstack.io/feed/',                                  'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":7}', true),
('Vercel Blog',                'https://vercel.com/blog/feed.rss',                             'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', true),
('Netlify Blog',               'https://www.netlify.com/blog/index.xml',                       'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),
('HashiCorp Blog',             'https://www.hashicorp.com/blog/feed.xml',                      'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),
('Docker Blog',                'https://www.docker.com/blog/feed/',                            'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),
('GitLab Blog',                'https://about.gitlab.com/blog/atom.xml',                       'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),
('JetBrains Blog',             'https://blog.jetbrains.com/feed/',                             'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),
('Increment Magazine',         'https://increment.com/feed.xml',                               'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":60}', true),
('Dev.to',                     'https://dev.to/feed',                                          'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":3}', false),
('Smashing Magazine',          'https://www.smashingmagazine.com/feed/',                       'rss', ARRAY['DevTools'], '{"tier":2,"max_age_days":14}', false),

-- Tier 3 — Community
('HN — Dev',                   null, 'hackernews', ARRAY['DevTools'], '{"tier":3,"query":"open source developer tool cli sdk","min_score":120}', true),
('r/devops',                   null, 'reddit',     ARRAY['DevTools'], '{"tier":3,"subreddit":"devops","min_score":80}', true),
('r/programming',              null, 'reddit',     ARRAY['DevTools'], '{"tier":3,"subreddit":"programming","min_score":150}', false),
('r/webdev',                   null, 'reddit',     ARRAY['DevTools'], '{"tier":3,"subreddit":"webdev","min_score":80}', false),
('r/rust',                     null, 'reddit',     ARRAY['DevTools'], '{"tier":3,"subreddit":"rust","min_score":80}', false),
('HN — Show HN',               null, 'hackernews', ARRAY['DevTools'], '{"tier":3,"query":"Show HN","min_score":60}', true),
('Product Hunt — DevTools',    null, 'producthunt',ARRAY['DevTools'], '{"tier":3,"topic":"developer-tools"}', true),


-- ═══════════════════════════════════════════════════════════════════════
-- HR Tech  (25 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Analyst, Insider, Deep-Practitioner
('Josh Bersin Blog',           'https://joshbersin.com/feed/',                                 'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":21}', true),
('HR Brew — Morning Brew',     'https://www.morningbrew.com/hr-brew/rss',                      'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":7}', true),
('ERE Media',                  'https://www.ere.net/feed/',                                    'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":7}', true),
('AIHR Blog',                  'https://www.aihr.com/blog/feed/',                              'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":14}', true),
('Future of Work Exchange',    'https://futureofworkexchange.com/feed/',                        'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":14}', true),
('Workology Blog',             'https://workology.com/feed/',                                  'rss', ARRAY['HR Tech'], '{"tier":1,"max_age_days":14}', false),

-- Tier 2 — Redaktionell
('HR Dive',                    'https://www.hrdive.com/feeds/news/',                           'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', true),
('SHRM HR News',               'https://www.shrm.org/rss/feeds/hr-news.xml',                   'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', true),
('HR Morning',                 'https://www.hrmorning.com/feed/',                              'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', true),
('HR Grapevine',               'https://www.hrgrapevine.com/rss',                              'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', false),
('People Management',          'https://www.peoplemanagement.co.uk/rss',                       'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', false),
('The HR Director',            'https://www.thehrdirector.com/rss',                            'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":7}', false),
('Greenhouse Blog',            'https://www.greenhouse.com/blog/feed',                         'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":21}', false),
('Lever Blog',                 'https://www.lever.co/blog/feed',                               'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":21}', false),
('Culture Amp Blog',           'https://www.cultureamp.com/blog/feed',                         'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":21}', false),
('Lattice Blog',               'https://lattice.com/blog/feed',                                'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":21}', false),
('HiBob Blog',                 'https://www.hibob.com/blog/feed/',                             'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":21}', false),
('Remote Blog',                'https://remote.com/blog/feed',                                 'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":14}', true),
('Deel Blog',                  'https://www.deel.com/blog/feed',                               'rss', ARRAY['HR Tech'], '{"tier":2,"max_age_days":14}', false),

-- Tier 3 — Community
('HN — HR Tech',               null, 'hackernews', ARRAY['HR Tech'], '{"tier":3,"query":"recruiting hiring remote work hr software","min_score":60}', true),
('r/recruiting',               null, 'reddit',     ARRAY['HR Tech'], '{"tier":3,"subreddit":"recruiting","min_score":40}', true),
('r/humanresources',           null, 'reddit',     ARRAY['HR Tech'], '{"tier":3,"subreddit":"humanresources","min_score":40}', false),
('r/remotework',               null, 'reddit',     ARRAY['HR Tech'], '{"tier":3,"subreddit":"remotework","min_score":40}', false),
('Product Hunt — HR',          null, 'producthunt',ARRAY['HR Tech'], '{"tier":3,"topic":"human-resources"}', true),
('HN — Future of Work',        null, 'hackernews', ARRAY['HR Tech'], '{"tier":3,"query":"remote work asynchronous team management","min_score":80}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- Marketing Tech  (27 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Practitioner-Level, taktisch tief
('Ahrefs Blog',                'https://ahrefs.com/blog/rss.xml',                              'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":21}', true),
('Backlinko',                  'https://backlinko.com/feed',                                   'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":30}', true),
('SparkToro Blog — Rand Fishkin','https://sparktoro.com/blog/feed/',                           'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":21}', true),
('Marketing Brew',             'https://www.morningbrew.com/marketing/rss',                    'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":7}', true),
('CXL Blog',                   'https://cxl.com/blog/feed/',                                   'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":21}', true),
('Demand Gen Report',          'https://www.demandgenreport.com/feed/',                        'rss', ARRAY['Marketing Tech'], '{"tier":1,"max_age_days":14}', true),

-- Tier 2 — Redaktionell, Plattform-Blogs
('MarTech.org',                'https://martech.org/feed/',                                    'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', true),
('Search Engine Journal',      'https://www.searchenginejournal.com/feed/',                    'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', true),
('Search Engine Land',         'https://searchengineland.com/feed',                            'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', true),
('Moz Blog',                   'https://moz.com/blog/feed',                                    'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":14}', true),
('Content Marketing Institute','https://contentmarketinginstitute.com/feed/',                  'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":14}', false),
('Marketing Week',             'https://www.marketingweek.com/feed/',                          'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', false),
('Digiday',                    'https://digiday.com/feed/',                                    'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', true),
('The Drum',                   'https://www.thedrum.com/rss',                                  'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', false),
('Convince & Convert',         'https://www.convinceandconvert.com/feed/',                     'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":14}', false),
('MarketingProfs',             'https://www.marketingprofs.com/rss/articles.rss',              'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":14}', false),
('Hotjar Blog',                'https://www.hotjar.com/blog/feed/',                            'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":21}', false),
('Orbit Media Studies',        'https://www.orbitmedia.com/feed/',                             'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":21}', false),
('Klaviyo Blog',               'https://www.klaviyo.com/blog/feed',                            'rss', ARRAY['Marketing Tech','E-Commerce'], '{"tier":2,"max_age_days":21}', false),
('HubSpot Marketing Blog',     'https://blog.hubspot.com/marketing/rss.xml',                   'rss', ARRAY['Marketing Tech'], '{"tier":2,"max_age_days":7}', true),

-- Tier 3 — Community
('HN — Growth',                null, 'hackernews', ARRAY['Marketing Tech'], '{"tier":3,"query":"growth marketing attribution seo","min_score":80}', true),
('r/PPC',                      null, 'reddit',     ARRAY['Marketing Tech'], '{"tier":3,"subreddit":"PPC","min_score":30}', true),
('r/SEO',                      null, 'reddit',     ARRAY['Marketing Tech'], '{"tier":3,"subreddit":"SEO","min_score":50}', true),
('r/digital_marketing',        null, 'reddit',     ARRAY['Marketing Tech'], '{"tier":3,"subreddit":"digital_marketing","min_score":40}', false),
('r/content_marketing',        null, 'reddit',     ARRAY['Marketing Tech'], '{"tier":3,"subreddit":"content_marketing","min_score":30}', false),
('Product Hunt — Marketing',   null, 'producthunt',ARRAY['Marketing Tech'], '{"tier":3,"topic":"marketing"}', true),
('HN — Email Marketing',       null, 'hackernews', ARRAY['Marketing Tech'], '{"tier":3,"query":"email newsletter marketing automation","min_score":60}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- FinTech  (26 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Analyst, Insider, Deep-Practitioner
('Finextra',                   'https://www.finextra.com/rss/channel.aspx?channel=news',       'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":7}', true),
('Tearsheet',                  'https://tearsheet.co/feed/',                                   'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":7}', true),
('The Financial Brand',        'https://thefinancialbrand.com/feed/',                          'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":7}', true),
('Lex Sokolin — Fintech Blueprint','https://www.alexsokolin.com/feed',                         'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":14}', true),
('Sifted — FinTech',           'https://sifted.eu/topic/fintech/feed/',                        'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":7}', true),
('a16z — FinTech',             'https://a16z.com/topic/fintech/feed/',                         'rss', ARRAY['FinTech'], '{"tier":1,"max_age_days":30}', true),

-- Tier 2 — Redaktionell, Nischen-Pubs
('PYMNTS',                     'https://www.pymnts.com/feed/',                                 'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', true),
('Fintech Futures',            'https://www.fintechfutures.com/feed/',                         'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', true),
('Finovate Blog',              'https://finovate.com/feed/',                                   'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', true),
('AltFi',                      'https://altfi.com/feed/',                                      'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', true),
('The Paypers',                'https://thepaypers.com/rss/',                                  'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', false),
('FinTech Magazine',           'https://fintechmagazine.com/feed',                             'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', false),
('Let''s Talk Payments',       'https://letstalkpayments.com/feed/',                           'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', false),
('Plaid Blog',                 'https://plaid.com/blog/feed/',                                 'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":30}', false),
('Stripe Blog',                'https://stripe.com/blog/feed.rss',                             'rss', ARRAY['FinTech','DevTools'], '{"tier":2,"max_age_days":21}', true),
('Revolut Blog',               'https://blog.revolut.com/rss/',                                'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":21}', false),
('Monzo Blog',                 'https://monzo.com/blog/feed/',                                 'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":21}', false),
('Global Finance Magazine',    'https://gfmag.com/feed/',                                      'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":14}', false),
('Banking Technology',         'https://www.bankingtech.com/feed/',                            'rss', ARRAY['FinTech'], '{"tier":2,"max_age_days":7}', false),

-- Tier 3 — Community
('HN — FinTech',               null, 'hackernews', ARRAY['FinTech'], '{"tier":3,"query":"fintech payments banking neobank","min_score":80}', true),
('r/fintech',                  null, 'reddit',     ARRAY['FinTech'], '{"tier":3,"subreddit":"fintech","min_score":50}', true),
('r/banking',                  null, 'reddit',     ARRAY['FinTech'], '{"tier":3,"subreddit":"banking","min_score":40}', false),
('r/personalfinance',          null, 'reddit',     ARRAY['FinTech'], '{"tier":3,"subreddit":"personalfinance","min_score":150}', false),
('Product Hunt — FinTech',     null, 'producthunt',ARRAY['FinTech'], '{"tier":3,"topic":"fintech"}', true),
('HN — Open Banking',          null, 'hackernews', ARRAY['FinTech'], '{"tier":3,"query":"open banking api payments crypto defi","min_score":80}', false),
('r/CryptoCurrency',           null, 'reddit',     ARRAY['FinTech'], '{"tier":3,"subreddit":"CryptoCurrency","min_score":200}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- E-Commerce  (26 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Analyst, Operator-Insider
('Modern Retail',              'https://www.modernretail.co/feed/',                            'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":7}', true),
('2PM Inc',                    'https://2pml.com/feed/',                                       'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":14}', true),
('Retail Brew',                'https://www.morningbrew.com/retail/rss',                       'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":7}', true),
('Baymard Institute Blog',     'https://baymard.com/blog/articles.rss',                        'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":30}', true),
('Tinuiti Blog',               'https://tinuiti.com/blog/feed/',                               'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":14}', false),
('Jungle Scout Blog',          'https://www.junglescout.com/blog/feed/',                       'rss', ARRAY['E-Commerce'], '{"tier":1,"max_age_days":14}', false),

-- Tier 2 — Redaktionell, Plattform-Blogs
('Practical Ecommerce',        'https://www.practicalecommerce.com/feed',                      'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', true),
('Retail Dive',                'https://www.retaildive.com/feeds/news/',                       'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":7}', true),
('Digital Commerce 360',       'https://www.digitalcommerce360.com/feed/',                     'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":7}', true),
('Econsultancy',               'https://econsultancy.com/feed/',                               'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', true),
('Shopify Partners Blog',      'https://www.shopify.com/partners/blog/feed.atom',              'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', true),
('Shopify Engineering',        'https://shopify.engineering/feed',                             'rss', ARRAY['E-Commerce','DevTools'], '{"tier":2,"max_age_days":21}', false),
('BigCommerce Blog',           'https://www.bigcommerce.com/blog/feed/',                       'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', false),
('Omnisend Blog',              'https://www.omnisend.com/blog/feed/',                          'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":21}', false),
('A Better Lemonade Stand',    'https://www.abetterlemonadestand.com/feed/',                   'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', false),
('McKinsey — Retail',          'https://www.mckinsey.com/industries/retail/our-insights/rss', 'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":30}', true),
('Ecommerce MasterPlan',       'https://www.ecommercemasterplan.com/feed/',                    'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":14}', false),
('WooCommerce Blog',           'https://woocommerce.com/posts/feed/',                          'rss', ARRAY['E-Commerce'], '{"tier":2,"max_age_days":21}', false),

-- Tier 3 — Community
('HN — E-Commerce',            null, 'hackernews', ARRAY['E-Commerce'], '{"tier":3,"query":"ecommerce shopify marketplace amazon","min_score":60}', true),
('r/ecommerce',                null, 'reddit',     ARRAY['E-Commerce'], '{"tier":3,"subreddit":"ecommerce","min_score":50}', true),
('r/FulfillmentByAmazon',      null, 'reddit',     ARRAY['E-Commerce'], '{"tier":3,"subreddit":"FulfillmentByAmazon","min_score":40}', false),
('r/shopify',                  null, 'reddit',     ARRAY['E-Commerce'], '{"tier":3,"subreddit":"shopify","min_score":40}', false),
('r/dropship',                 null, 'reddit',     ARRAY['E-Commerce'], '{"tier":3,"subreddit":"dropship","min_score":30}', false),
('Product Hunt — E-Commerce',  null, 'producthunt',ARRAY['E-Commerce'], '{"tier":3,"topic":"e-commerce"}', true),
('HN — DTC',                   null, 'hackernews', ARRAY['E-Commerce'], '{"tier":3,"query":"direct to consumer brand retail shopify","min_score":60}', false),


-- ═══════════════════════════════════════════════════════════════════════
-- Productivity  (24 Quellen)
-- ═══════════════════════════════════════════════════════════════════════

-- Tier 1 — Thought Leader, tief
('Ness Labs — Anne-Laure Le Cunff','https://nesslabs.com/feed',                               'rss', ARRAY['Productivity'], '{"tier":1,"max_age_days":21}', true),
('Forte Labs — Tiago Forte',   'https://fortelabs.com/blog/feed/',                            'rss', ARRAY['Productivity'], '{"tier":1,"max_age_days":30}', true),
('Cal Newport',                'https://calnewport.com/blog/feed/',                            'rss', ARRAY['Productivity'], '{"tier":1,"max_age_days":30}', true),
('Maggie Appleton — Digital Gardens','https://maggieappleton.com/rss.xml',                    'rss', ARRAY['Productivity'], '{"tier":1,"max_age_days":60}', false),
('Readwise Blog',              'https://blog.readwise.io/rss/',                                'rss', ARRAY['Productivity'], '{"tier":1,"max_age_days":30}', true),
('Lenny''s Newsletter',        'https://www.lennysnewsletter.com/feed',                        'rss', ARRAY['Productivity','B2B SaaS'], '{"tier":1,"max_age_days":21}', true),

-- Tier 2 — Kuratiert, Plattform-Blogs
('Linear Blog',                'https://linear.app/blog/rss.xml',                              'rss', ARRAY['Productivity','DevTools'], '{"tier":2,"max_age_days":21}', true),
('Zapier Blog',                'https://zapier.com/blog/feeds/latest/',                        'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":14}', true),
('Notion Blog',                'https://www.notion.so/blog/rss.xml',                           'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":21}', true),
('Obsidian Blog',              'https://obsidian.md/blog/rss.xml',                             'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":30}', false),
('Todoist Blog',               'https://todoist.com/inspiration/feed',                         'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":21}', false),
('Make Blog',                  'https://www.make.com/en/blog/feed/rss',                        'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":14}', false),
('Asian Efficiency',           'https://www.asianefficiency.com/feed/',                        'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":21}', false),
('Process.st Blog',            'https://www.process.st/blog/feed/',                            'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":21}', false),
('Harvard Business Review — Productivity','https://hbr.org/topic/subject/productivity/rss',  'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":14}', true),
('Workflowy Blog',             'https://workflowy.com/news/feed/',                             'rss', ARRAY['Productivity'], '{"tier":2,"max_age_days":30}', false),
('Indie Hackers',              'https://www.indiehackers.com/posts.rss',                       'rss', ARRAY['Productivity','B2B SaaS'], '{"tier":2,"max_age_days":7}', true),

-- Tier 3 — Community
('HN — Productivity',          null, 'hackernews', ARRAY['Productivity'], '{"tier":3,"query":"productivity workflow knowledge management second brain","min_score":100}', true),
('r/PKM',                      null, 'reddit',     ARRAY['Productivity'], '{"tier":3,"subreddit":"PKM","min_score":40}', true),
('r/ObsidianMD',               null, 'reddit',     ARRAY['Productivity'], '{"tier":3,"subreddit":"ObsidianMD","min_score":50}', false),
('r/gtd',                      null, 'reddit',     ARRAY['Productivity'], '{"tier":3,"subreddit":"gtd","min_score":30}', false),
('r/Notion',                   null, 'reddit',     ARRAY['Productivity'], '{"tier":3,"subreddit":"Notion","min_score":50}', false),
('Product Hunt — Productivity',null, 'producthunt',ARRAY['Productivity'], '{"tier":3,"topic":"productivity"}', true),
('HN — Tools for Thought',     null, 'hackernews', ARRAY['Productivity'], '{"tier":3,"query":"note-taking tools for thought personal knowledge","min_score":80}', false);
