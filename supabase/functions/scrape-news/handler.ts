// Bot: News-Scrape aus allen aktiven Sources einer Company.
// Triggert: pg_cron wöchentlich plus manuell aus dem Dashboard.
// Schreibt: Items in temporäre Liste, enqueued niche_news_cluster Job.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, Source } from "../_shared/types.ts";

const MAX_ITEMS_PER_SOURCE = 30;

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("niche_news_scrape benötigt company_id.");

  const { data: companySources, error } = await client
    .from("company_sources")
    .select("source_id, sources(*)")
    .eq("company_id", job.company_id)
    .eq("active", true);

  if (error) throw new Error(`company_sources query failed: ${error.message}`);
  if (!companySources || companySources.length === 0) {
    return { items_total: 0, message: "Keine aktiven Sources für diese Company." };
  }

  const allItems: NewsItem[] = [];

  for (const row of companySources) {
    // deno-lint-ignore no-explicit-any
    const source = (row as any).sources as Source;
    if (!source) continue;

    try {
      const items = await fetchSource(source);
      allItems.push(...items.slice(0, MAX_ITEMS_PER_SOURCE));
    } catch (err) {
      console.error(`Source ${source.name} failed:`, err);
    }
  }

  // Enqueue clustering job mit allen Items.
  const { data: clusterJob, error: enqueueErr } = await client
    .from("jobs")
    .insert({
      type: "niche_news_cluster",
      company_id: job.company_id,
      payload: { items: allItems, scrape_job_id: job.id },
      depends_on: [job.id],
    })
    .select()
    .single();

  if (enqueueErr) throw new Error(`Cluster-Job konnte nicht enqueued werden: ${enqueueErr.message}`);

  return {
    items_total: allItems.length,
    sources_processed: companySources.length,
    cluster_job_id: clusterJob?.id,
  };
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
    case "twitter":
      console.warn("Twitter-Source noch nicht implementiert.");
      return [];
    case "custom":
      return [];
    default:
      return [];
  }
}

// RSS-Parser. Simple regex-basiert. Bei komplexeren Feeds kann man auf einen Parser umsteigen.
async function fetchRss(source: Source): Promise<NewsItem[]> {
  if (!source.url) return [];
  const response = await fetch(source.url, { headers: { "user-agent": "berlin-saas-bot/1.0" } });
  if (!response.ok) throw new Error(`RSS ${source.url} failed: ${response.status}`);
  const xml = await response.text();

  const items: NewsItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>([\s\S]*?)<\/link>/i;
  const dateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;

  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches) {
    const title = block.match(titleRegex)?.[1]?.trim() ?? "";
    const url = block.match(linkRegex)?.[1]?.trim() ?? "";
    const dateStr = block.match(dateRegex)?.[1]?.trim();
    if (!title || !url) continue;

    items.push({
      title,
      url,
      source_name: source.name,
      published_at: dateStr ? new Date(dateStr).toISOString() : null,
      raw: { source_type: "rss" },
    });
  }
  return items;
}

// NewsAPI.org Integration.
// TODO: NEWSAPI_KEY in Supabase Vault setzen vor Tag 4.
async function fetchNewsApi(source: Source): Promise<NewsItem[]> {
  const key = Deno.env.get("NEWSAPI_KEY");
  if (!key) {
    console.warn("NEWSAPI_KEY nicht gesetzt, skip NewsAPI source.");
    return [];
  }
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
    published_at: a.publishedAt,
    raw: { description: a.description, source_type: "newsapi" },
  }));
}

// Reddit-API via JSON-Endpoint (kein OAuth nötig für public subreddits).
async function fetchReddit(source: Source): Promise<NewsItem[]> {
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const subreddit = config.subreddit;
  if (!subreddit) return [];

  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=20`;
  const response = await fetch(url, { headers: { "user-agent": "berlin-saas-bot/1.0" } });
  if (!response.ok) throw new Error(`Reddit ${subreddit} failed: ${response.status}`);
  const data = await response.json();

  // deno-lint-ignore no-explicit-any
  return (data.data?.children ?? []).map((c: any) => ({
    title: c.data.title,
    url: `https://reddit.com${c.data.permalink}`,
    source_name: `r/${subreddit}`,
    published_at: new Date(c.data.created_utc * 1000).toISOString(),
    raw: { score: c.data.score, num_comments: c.data.num_comments, source_type: "reddit" },
  }));
}

// Hacker News via Algolia-API (kostenlos, kein Auth).
async function fetchHackerNews(source: Source): Promise<NewsItem[]> {
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const query = config.query ?? "";
  const minScore = config.min_score ?? 50;

  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `points>=${minScore}`);
  url.searchParams.set("hitsPerPage", "20");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HN failed: ${response.status}`);
  const data = await response.json();

  // deno-lint-ignore no-explicit-any
  return (data.hits ?? []).map((h: any) => ({
    title: h.title,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    source_name: "Hacker News",
    published_at: h.created_at,
    raw: { points: h.points, source_type: "hackernews" },
  }));
}

// ProductHunt via GraphQL-API.
// TODO: PRODUCTHUNT_TOKEN in Supabase Vault setzen vor Tag 4.
async function fetchProductHunt(source: Source): Promise<NewsItem[]> {
  const token = Deno.env.get("PRODUCTHUNT_TOKEN");
  if (!token) {
    console.warn("PRODUCTHUNT_TOKEN nicht gesetzt, skip ProductHunt.");
    return [];
  }
  // deno-lint-ignore no-explicit-any
  const config = source.config as any;
  const topic = config.topic ?? "";

  const query = `
    query Posts($topic: String) {
      posts(topic: $topic, order: VOTES, first: 20) {
        edges {
          node {
            id
            name
            tagline
            url
            createdAt
            votesCount
          }
        }
      }
    }
  `;

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
    published_at: e.node.createdAt,
    raw: { votes: e.node.votesCount, source_type: "producthunt" },
  }));
}
