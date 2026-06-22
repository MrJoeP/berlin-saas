// Bot: News-Scrape aus allen aktiven Sources einer Company.
// Triggert: pg_cron wöchentlich plus manuell aus dem Dashboard.
// Schreibt: Items in temporäre Liste, enqueued niche_news_cluster Job.
//
// Pre-Filter-Pipeline:
//   1. Pro Source bis zu MAX_RAW_ITEMS_PER_SOURCE holen
//   2. Score-Filter (Reddit upvotes, HN points)
//   3. Age-Filter (max_age_days)
//   4. Dedup (normalisierte URL + Title)
//   5. Keyword-Match gegen Company-Keywords (soft, T1 bypasst)
//   6. Pool-Cap auf MAX_FILTERED_ITEMS

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, Source } from "../_shared/types.ts";

const MAX_RAW_ITEMS_PER_SOURCE = 150;
const MAX_FILTERED_ITEMS = 400;

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("niche_news_scrape benötigt company_id.");

  const { data: company } = await client
    .from("companies")
    .select("keywords")
    .eq("id", job.company_id)
    .single();

  const keywords = (company?.keywords ?? []) as string[];

  const { data: companySources, error } = await client
    .from("company_sources")
    .select("source_id, sources(*)")
    .eq("company_id", job.company_id)
    .eq("active", true);

  if (error) throw new Error(`company_sources query failed: ${error.message}`);
  if (!companySources || companySources.length === 0) {
    return { items_total: 0, message: "Keine aktiven Sources." };
  }

  const rawItems: NewsItem[] = [];
  const sourceStats: Record<string, number> = {};

  for (const row of companySources) {
    // deno-lint-ignore no-explicit-any
    const source = (row as any).sources as Source;
    if (!source) continue;

    try {
      const items = await fetchSource(source);
      const tagged = items.slice(0, MAX_RAW_ITEMS_PER_SOURCE).map((item) => ({
        ...item,
        source_tier: source.tier ?? 3,
      }));
      rawItems.push(...tagged);
      sourceStats[source.name] = tagged.length;
    } catch (err) {
      console.error(`Source ${source.name} failed:`, err);
      sourceStats[source.name] = 0;
    }
  }

  // Pre-Filter Pipeline.
  const filtered = filterItems(rawItems, companySources, keywords);

  const { data: clusterJob, error: enqueueErr } = await client
    .from("jobs")
    .insert({
      type: "niche_news_cluster",
      company_id: job.company_id,
      payload: { items: filtered, scrape_job_id: job.id },
      depends_on: [job.id],
    })
    .select()
    .single();

  if (enqueueErr) throw new Error(`Cluster-Job enqueue failed: ${enqueueErr.message}`);

  return {
    items_raw: rawItems.length,
    items_filtered: filtered.length,
    sources_processed: companySources.length,
    source_stats: sourceStats,
    cluster_job_id: clusterJob?.id,
  };
}

// deno-lint-ignore no-explicit-any
function filterItems(items: NewsItem[], companySources: any[], keywords: string[]): NewsItem[] {
  // Source-Config Lookup für Score/Age-Thresholds.
  const sourceConfig: Record<string, { min_score: number; max_age_days: number; tier: number }> = {};
  for (const row of companySources) {
    const s = row.sources as Source;
    if (!s) continue;
    sourceConfig[s.name] = {
      min_score: s.min_score ?? 0,
      max_age_days: s.max_age_days ?? 7,
      tier: s.tier ?? 3,
    };
  }

  const now = Date.now();
  const seen = new Set<string>();
  // Keywords in einzelne Tokens zerlegen — "SEO Agentur" → ["seo", "agentur"].
  // Match auf irgendeinen Token statt ganze Phrase. Sonst filtern deutsche Phrasen
  // englischen Community-Content (YouTube, Twitter, internationale Reddit-Subs) weg.
  const KEYWORD_STOPWORDS = new Set([
    "und", "der", "die", "das", "für", "fur", "mit", "von", "the", "and", "for", "with", "ein", "eine",
  ]);
  const keywordTokens = keywords
    .flatMap((k) => k.toLowerCase().split(/[\s\-,.&/]+/))
    .filter((t) => t.length >= 3 && !KEYWORD_STOPWORDS.has(t));

  const passed: NewsItem[] = [];

  for (const item of items) {
    const cfg = sourceConfig[item.source_name] ?? { min_score: 0, max_age_days: 7, tier: 3 };

    // 1. Score-Filter (Reddit upvotes, HN points).
    if (cfg.min_score > 0 && (item.score ?? 0) < cfg.min_score) continue;

    // 2. Age-Filter.
    if (item.published_at) {
      const ageMs = now - new Date(item.published_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > cfg.max_age_days) continue;
    }

    // 3. Dedup.
    const dedupKey = normalize(item.url) + "|" + normalize(item.title).slice(0, 80);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    // 4. Keyword-Match nur für T3 — auf einzelne Tokens, nicht ganze Phrasen.
    if (keywordTokens.length > 0 && cfg.tier === 3) {
      const haystack = (item.title + " " + (item.raw.description ?? "")).toLowerCase();
      const matches = keywordTokens.some((kw) => haystack.includes(kw));
      if (!matches) continue;
    }

    passed.push(item);
  }

  // Sortierung: T1 vor T2 vor T3, dann nach Score, dann nach Datum.
  passed.sort((a, b) => {
    if (a.source_tier !== b.source_tier) return a.source_tier - b.source_tier;
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });

  return passed.slice(0, MAX_FILTERED_ITEMS);
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 200);
}

async function fetchSource(source: Source): Promise<NewsItem[]> {
  switch (source.type) {
    case "rss": return await fetchRss(source);
    case "newsapi": return await fetchNewsApi(source);
    case "reddit": return await fetchReddit(source);
    case "hackernews": return await fetchHackerNews(source);
    case "producthunt": return await fetchProductHunt(source);
    default: return [];
  }
}

async function fetchRss(source: Source): Promise<NewsItem[]> {
  if (!source.url) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let xml: string;
  try {
    const response = await fetch(source.url, {
      headers: { "user-agent": "berlin-saas-bot/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`RSS ${source.url} failed: ${response.status}`);
    xml = await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
  const items: NewsItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*?(?:href="([^"]+)"|>([^<]+)<\/link>)/i;
  const dateRegex = /<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches) {
    const title = block.match(titleRegex)?.[1]?.trim() ?? "";
    const linkMatch = block.match(linkRegex);
    const url = (linkMatch?.[1] ?? linkMatch?.[2] ?? "").trim();
    const dateStr = block.match(dateRegex)?.[2]?.trim();
    if (!title || !url) continue;
    items.push({
      title,
      url,
      source_name: source.name,
      source_tier: source.tier,
      published_at: dateStr ? safeIsoDate(dateStr) : null,
      score: null,
      raw: { source_type: "rss" },
    });
  }
  return items;
}

function safeIsoDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch { return null; }
}

async function fetchNewsApi(source: Source): Promise<NewsItem[]> {
  const key = Deno.env.get("NEWSAPI_KEY");
  if (!key) return [];
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const keywords = (config.keywords ?? []).join(" OR ");
  if (!keywords) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", keywords);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "20");
  const response = await fetch(url, { headers: { "x-api-key": key } });
  if (!response.ok) throw new Error(`NewsAPI failed: ${response.status}`);
  const data = await response.json();
  // deno-lint-ignore no-explicit-any
  return (data.articles ?? []).map((a: any) => ({
    title: a.title,
    url: a.url,
    source_name: a.source?.name ?? source.name,
    source_tier: source.tier,
    published_at: a.publishedAt,
    score: null,
    raw: { description: a.description, source_type: "newsapi" },
  }));
}

async function fetchReddit(source: Source): Promise<NewsItem[]> {
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const subreddit = config.subreddit;
  if (!subreddit) return [];
  // Reddit blockt JSON API aggressiv. .rss Endpoint ist lockerer.
  // Items kommen ohne Score zurück, also setzen wir Score = source.min_score
  // damit der Score-Filter (config.min_score) sie nicht direkt rauswirft.
  const url = `https://www.reddit.com/r/${subreddit}/top.rss?t=week&limit=50`;
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; berlin-saas-digest/1.0)" },
  });
  if (!response.ok) throw new Error(`Reddit ${subreddit} failed: ${response.status}`);
  const xml = await response.text();
  const items: NewsItem[] = [];
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*?href="([^"]+)"/i;
  const updatedRegex = /<updated[^>]*>([\s\S]*?)<\/updated>/i;
  const matches = xml.match(entryRegex) ?? [];
  for (const block of matches) {
    const title = block.match(titleRegex)?.[1]?.trim();
    const url = block.match(linkRegex)?.[1]?.trim();
    const updatedStr = block.match(updatedRegex)?.[1]?.trim();
    if (!title || !url) continue;
    items.push({
      title,
      url,
      source_name: `r/${subreddit}`,
      source_tier: source.tier,
      published_at: updatedStr ? safeIsoDate(updatedStr) : null,
      score: source.min_score, // pseudo-score, bypasses min_score filter
      raw: { source_type: "reddit" },
    });
  }
  return items;
}

async function fetchHackerNews(source: Source): Promise<NewsItem[]> {
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const query = config.query ?? "";
  const minScore = config.min_score ?? source.min_score ?? 50;
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `points>=${minScore}`);
  url.searchParams.set("hitsPerPage", "30");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HN failed: ${response.status}`);
  const data = await response.json();
  // deno-lint-ignore no-explicit-any
  return (data.hits ?? []).map((h: any) => ({
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source_name: "Hacker News",
    source_tier: source.tier,
    published_at: h.created_at,
    score: h.points ?? 0,
    raw: { source_type: "hackernews" },
  }));
}

async function fetchProductHunt(source: Source): Promise<NewsItem[]> {
  const token = Deno.env.get("PRODUCTHUNT_TOKEN");
  if (!token) return [];
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const topic = config.topic ?? "";
  const query = `query Posts($topic: String) { posts(topic: $topic, order: VOTES, first: 20) { edges { node { id name tagline url createdAt votesCount } } } }`;
  const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { topic } }),
  });
  if (!response.ok) throw new Error(`ProductHunt failed: ${response.status}`);
  const data = await response.json();
  // deno-lint-ignore no-explicit-any
  return (data.data?.posts?.edges ?? []).map((e: any) => ({
    title: `${e.node.name}: ${e.node.tagline}`,
    url: e.node.url,
    source_name: "Product Hunt",
    source_tier: source.tier,
    published_at: e.node.createdAt,
    score: e.node.votesCount ?? 0,
    raw: { source_type: "producthunt" },
  }));
}
