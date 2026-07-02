import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem } from "../_shared/types.ts";
import {
  capMutedSources,
  loadRelevanceProfile,
  sourceWeightFor,
  topicBoost,
} from "../_shared/relevance.ts";

const MAX_PER_SOURCE = 50;
const WINDOW_DAYS = 7;
const MAX_TOTAL_ITEMS = 200;

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");

  const { data: co } = await c
    .from("companies")
    .select(
      "name, industry, niche, keywords, icp, product_description, target_market",
    )
    .eq("id", job.company_id)
    .single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const kw = (co.keywords ?? []) as string[];
  const name = co.name as string;
  const niche = (co.niche ?? "") as string;
  const sinceTs = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;

  const terms = [name, ...kw.slice(0, 3), niche].filter(Boolean);
  const query = terms.slice(0, 4).join(" ");

  // Published Content respects active company_sources: toggled-off sources are not fetched.
  const { data: companySources } = await c
    .from("company_sources")
    .select("sources(*)")
    .eq("company_id", job.company_id)
    .eq("active", true);

  const redditSubs: { subreddit: string; minScore: number }[] = [];
  const hnConfigs: { query: string; minScore: number }[] = [];
  const rssConfigs: { name: string; url: string }[] = [];
  let fetchProductHuntSource = false;

  for (const row of companySources ?? []) {
    // deno-lint-ignore no-explicit-any
    const src = (row as any).sources;
    if (!src) continue;
    const scope = (src.config?.feed_scope as string | undefined) ?? "";
    const platform = src.config?.platform as string | undefined;
    if (src.type === "reddit" && src.config?.subreddit) {
      redditSubs.push({
        subreddit: src.config.subreddit as string,
        minScore: (src.config.min_score ?? src.min_score ?? 10) as number,
      });
    }
    if (src.type === "hackernews") {
      hnConfigs.push({
        query: (src.config.query as string | undefined) ?? query,
        minScore: (src.config.min_score ?? src.min_score ?? 50) as number,
      });
    }
    if (src.type === "producthunt") {
      fetchProductHuntSource = true;
    }
    const isUserTopPost = (src.type === "rss" || src.type === "custom") &&
      (scope === "top_post" || scope === "both");
    const isSocialRss = src.type === "rss" &&
      (platform === "YouTube" || platform === "Twitter/X" ||
        platform === "LinkedIn");
    if (src.url && (isUserTopPost || isSocialRss)) {
      rssConfigs.push({ name: src.name as string, url: src.url as string });
    }
  }

  const results = await Promise.allSettled([
    ...hnConfigs.map((cfg) => fetchHNConfig(cfg.query, cfg.minScore, sinceTs)),
    ...(fetchProductHuntSource ? [fetchProductHunt(kw)] : []),
    ...(redditSubs.length > 0 ? [fetchRedditSearch(query, kw)] : []),
    ...redditSubs.slice(0, 24).map((cfg) =>
      fetchRedditSub(cfg.subreddit, cfg.minScore, kw)
    ),
    ...rssConfigs.slice(0, 40).map((cfg) => fetchRssCustom(cfg.url, cfg.name)),
  ]);

  const items: NewsItem[] = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> =>
      r.status === "fulfilled"
    )
    .flatMap((r) => r.value);

  const deduped = dedup(items);
  // Engagement-first Ranking, moduliert durch das gelernte Relevanz-Profil:
  // Score × Source-Weight + Topic-Boost. Gemutete Quellen werden gekappt.
  const profile = await loadRelevanceProfile(c, job.company_id, "top_post");
  const rank = (i: NewsItem) =>
    (i.score ?? 0) * sourceWeightFor(i, profile) + topicBoost(i, profile);
  const sorted = [...deduped].sort((a, b) => rank(b) - rank(a));
  const capped = capMutedSources(sorted, profile).slice(0, MAX_TOTAL_ITEMS);

  const { data: cj, error } = await c.from("jobs").insert({
    type: "top_post_cluster",
    company_id: job.company_id,
    payload: { items: capped, scrape_job_id: job.id },
    depends_on: [job.id],
  }).select().single();

  if (error) throw new Error(error.message);

  const bySource: Record<string, number> = {};
  for (const item of capped) {
    bySource[item.source_name] = (bySource[item.source_name] ?? 0) + 1;
  }

  return {
    items_found: capped.length,
    by_source: bySource,
    cluster_job_id: cj?.id,
  };
}

async function fetchHNConfig(
  query: string,
  minScore: number,
  sinceTs: number,
): Promise<NewsItem[]> {
  const u = new URL("https://hn.algolia.com/api/v1/search");
  u.searchParams.set("query", query);
  u.searchParams.set("tags", "story");
  u.searchParams.set(
    "numericFilters",
    `points>=${minScore},created_at_i>${sinceTs}`,
  );
  u.searchParams.set("hitsPerPage", "25");
  const r = await fetch(u);
  if (!r.ok) return [];
  const hits = (await r.json()).hits ?? [];
  return hits.map((h: any): NewsItem => ({
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source_name: "Hacker News",
    source_tier: 2,
    published_at: h.created_at,
    score: h.points ?? 0,
    raw: {
      source_type: "hackernews",
      comments: h.num_comments,
      hn_id: h.objectID,
    },
  }));
}

async function fetchProductHunt(kw: string[]): Promise<NewsItem[]> {
  const xml = await fetchRss("https://www.producthunt.com/feed");
  return parseRss(xml, "Product Hunt", 2)
    .filter((i) => matchesKw(i.title, kw))
    .slice(0, MAX_PER_SOURCE);
}

async function fetchRedditSearch(
  query: string,
  kw: string[],
): Promise<NewsItem[]> {
  const q = encodeURIComponent(query);
  const url =
    `https://www.reddit.com/search.json?q=${q}&sort=top&t=week&limit=50`;
  const r = await fetch(url, {
    headers: { "user-agent": "berlin-saas-bot/1.0" },
  });
  if (!r.ok) throw new Error(`Reddit search: ${r.status}`);
  const data = await r.json();
  const posts = (data?.data?.children ?? []) as any[];
  return posts
    .filter((p) => p.data.score >= 10 && matchesKw(p.data.title, kw))
    .map((p): NewsItem => ({
      title: p.data.title,
      url: p.data.url ?? `https://reddit.com${p.data.permalink}`,
      source_name: `Reddit r/${p.data.subreddit}`,
      source_tier: 2,
      published_at: new Date(p.data.created_utc * 1000).toISOString(),
      score: p.data.score,
      raw: {
        source_type: "reddit",
        subreddit: p.data.subreddit,
        comments: p.data.num_comments,
        upvote_ratio: p.data.upvote_ratio,
        excerpt: p.data.selftext?.slice(0, 600) ?? "",
      },
    }));
}

async function fetchRedditSub(
  subreddit: string,
  minScore: number,
  kw: string[],
): Promise<NewsItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=25`;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "berlin-saas-bot/1.0" },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const posts = (data?.data?.children ?? []) as any[];
    return posts
      .filter((p) =>
        p.data.score >= minScore &&
        matchesKw(`${p.data.title} ${p.data.selftext ?? ""}`, kw)
      )
      .map((p): NewsItem => ({
        title: p.data.title,
        url: p.data.url ?? `https://reddit.com${p.data.permalink}`,
        source_name: `Reddit r/${subreddit}`,
        source_tier: 2,
        published_at: new Date(p.data.created_utc * 1000).toISOString(),
        score: p.data.score,
        raw: {
          source_type: "reddit",
          subreddit,
          comments: p.data.num_comments,
          upvote_ratio: p.data.upvote_ratio,
          excerpt: p.data.selftext?.slice(0, 600) ?? "",
        },
      }));
  } catch {
    return [];
  }
}

// User-defined RSS feed scoped to Published Content. No engagement score, ranks via tier+recency.
async function fetchRssCustom(
  url: string,
  sourceName: string,
): Promise<NewsItem[]> {
  try {
    const xml = await fetchRss(url);
    return parseRss(xml, sourceName, 2).slice(0, MAX_PER_SOURCE);
  } catch {
    return [];
  }
}

async function fetchRss(url: string): Promise<string> {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "berlin-saas-bot/1.0" },
      signal: ac.signal,
    });
    clearTimeout(tm);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return await r.text();
  } catch (e) {
    clearTimeout(tm);
    throw e;
  }
}

function parseRss(
  xml: string,
  sourceName: string,
  tier: 1 | 2 | 3,
): NewsItem[] {
  const items: NewsItem[] = [];
  const ER = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
  const TR = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const LR = /<link[^>]*?(?:href="([^"]+)"|>([^<]+)<\/link>)/i;
  const DR =
    /<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i;
  const SR =
    /<(description|summary|content:encoded)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(description|summary|content:encoded)>/i;
  for (const b of xml.match(ER) ?? []) {
    const t = b.match(TR)?.[1]?.trim() ?? "";
    const lm = b.match(LR);
    const u = (lm?.[1] ?? lm?.[2] ?? "").trim();
    const ds = b.match(DR)?.[2]?.trim();
    const description = stripTags(b.match(SR)?.[2]?.trim() ?? "").slice(0, 800);
    if (!t || !u) continue;
    items.push({
      title: t,
      url: u,
      source_name: sourceName,
      source_tier: tier,
      published_at: ds ? iso(ds) : null,
      score: null,
      raw: { source_type: "rss", description },
    });
  }
  return items;
}

function matchesKw(text: string, kw: string[]): boolean {
  if (kw.length === 0) return true;
  const t = text.toLowerCase();
  return kw.some((k) => t.includes(k.toLowerCase()));
}

function dedup(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.url.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 100);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function iso(s: string): string | null {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
