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
import {
  type CompanySourceWithSource,
  filterItems,
} from "../_shared/news_filter.ts";

const MAX_RAW_ITEMS_PER_SOURCE = 150;
const MAX_FILTERED_ITEMS = 400;

export async function handle(
  job: Job,
  client: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) {
    throw new Error("niche_news_scrape benötigt company_id.");
  }

  const { data: company } = await client
    .from("companies")
    .select("keywords, negative_keywords")
    .eq("id", job.company_id)
    .single();

  const keywords = (company?.keywords ?? []) as string[];
  const negativeKeywords = (company?.negative_keywords ?? []) as string[];

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
  const sourceStats: Record<
    string,
    { fetched: number; accepted: number; error?: string }
  > = {};
  const sourceIdsByName: Record<string, string> = {};

  for (const row of companySources) {
    // deno-lint-ignore no-explicit-any
    const source = (row as any).sources as Source;
    if (!source) continue;
    const sourceId = (row as { source_id: string }).source_id;
    for (const alias of sourceAliases(source)) {
      sourceIdsByName[alias] = sourceId;
    }

    try {
      const items = await fetchSource(source);
      const tagged = items.slice(0, MAX_RAW_ITEMS_PER_SOURCE).map((item) => ({
        ...item,
        source_tier: source.tier ?? 3,
      }));
      rawItems.push(...tagged);
      sourceStats[source.name] = { fetched: tagged.length, accepted: 0 };
      for (const alias of sourceAliases(source)) {
        sourceStats[alias] = sourceStats[source.name];
      }
    } catch (err) {
      console.error(`Source ${source.name} failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      sourceStats[source.name] = { fetched: 0, accepted: 0, error: message };
      await recordSourceHealth(client, job.company_id, sourceId, 0, 0, message);
    }
  }

  // Pre-Filter Pipeline.
  const filtered = filterItems(
    rawItems,
    companySources as unknown as CompanySourceWithSource[],
    keywords,
    undefined,
    negativeKeywords,
  )
    .slice(0, MAX_FILTERED_ITEMS);

  for (const item of filtered) {
    const stat = sourceStats[item.source_name];
    if (stat) stat.accepted += 1;
  }
  const recordedSources = new Set<string>();
  await Promise.all(
    Object.entries(sourceStats).map(([sourceName, stat]) => {
      const sourceId = sourceIdsByName[sourceName];
      if (
        !sourceId || stat.error || recordedSources.has(sourceId)
      ) return Promise.resolve();
      recordedSources.add(sourceId);
      return recordSourceHealth(
        client,
        job.company_id!,
        sourceId,
        stat.fetched,
        stat.accepted,
        null,
      );
    }),
  );

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

  if (enqueueErr) {
    throw new Error(`Cluster-Job enqueue failed: ${enqueueErr.message}`);
  }

  return {
    items_raw: rawItems.length,
    items_filtered: filtered.length,
    sources_processed: companySources.length,
    source_stats: sourceStats,
    cluster_job_id: clusterJob?.id,
  };
}

function sourceAliases(source: Source): string[] {
  const aliases = new Set([source.name]);
  const config = source.config as Record<string, unknown>;
  if (source.type === "reddit" && typeof config.subreddit === "string") {
    aliases.add(`r/${config.subreddit}`);
  }
  if (source.type === "hackernews") aliases.add("Hacker News");
  if (source.type === "producthunt") aliases.add("Product Hunt");
  return [...aliases];
}

async function recordSourceHealth(
  client: SupabaseClient,
  companyId: string,
  sourceId: string,
  itemsFetched: number,
  itemsAccepted: number,
  error: string | null,
) {
  await client.from("source_health").upsert({
    company_id: companyId,
    source_id: sourceId,
    last_checked_at: new Date().toISOString(),
    last_success_at: error ? null : new Date().toISOString(),
    last_error_at: error ? new Date().toISOString() : null,
    last_error: error,
    items_fetched: itemsFetched,
    items_accepted: itemsAccepted,
  });
}

async function fetchSource(source: Source): Promise<NewsItem[]> {
  switch (source.type) {
    case "rss":
      return await fetchRss(source);
    case "newsapi":
      return await fetchNewsApi(source);
    case "reddit":
      return await fetchReddit(source);
    case "hackernews":
      return await fetchHackerNews(source);
    case "producthunt":
      return await fetchProductHunt(source);
    default:
      return [];
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
    if (!response.ok) {
      throw new Error(`RSS ${source.url} failed: ${response.status}`);
    }
    xml = await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
  const items: NewsItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  const titleRegex =
    /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*?(?:href="([^"]+)"|>([^<]+)<\/link>)/i;
  const dateRegex =
    /<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i;
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
  } catch {
    return null;
  }
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
  // Reddit blockt Supabase Edge Function IPs. Fallback-Versuche in Reihenfolge:
  // 1. Direct reddit.com .rss
  // 2. rsshub.app proxy als Alternative
  // Items kommen ohne Score zurück, also setzen wir Score = source.min_score.
  const urls = [
    `https://www.reddit.com/r/${subreddit}/top.rss?t=week&limit=50`,
    `https://rsshub.app/reddit/r/${subreddit}/top/week`,
  ];
  let response: Response | null = null;
  let lastErr: string = "";
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; berlin-saas-digest/1.0)",
        },
      });
      if (r.ok) {
        response = r;
        break;
      }
      lastErr = `${u} → ${r.status}`;
    } catch (e) {
      lastErr = `${u} → ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  if (!response) {
    throw new Error(`Reddit ${subreddit} failed all proxies: ${lastErr}`);
  }
  const xml = await response.text();
  const items: NewsItem[] = [];
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  const titleRegex =
    /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
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
  const query =
    `query Posts($topic: String) { posts(topic: $topic, order: VOTES, first: 20) { edges { node { id name tagline url createdAt votesCount } } } }`;
  const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
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
