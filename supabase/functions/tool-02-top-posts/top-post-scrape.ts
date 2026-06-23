import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem } from "../_shared/types.ts";

const MAX_PER_SOURCE = 30;
const WINDOW_DAYS = 7;

export async function handle(job: Job, c: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");

  const { data: co } = await c
    .from("companies")
    .select("name, industry, niche, keywords, icp, product_description, target_market")
    .eq("id", job.company_id)
    .single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const kw = (co.keywords ?? []) as string[];
  const name = co.name as string;
  const niche = (co.niche ?? "") as string;
  const sinceTs = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;

  const terms = [name, ...kw.slice(0, 3), niche].filter(Boolean);
  const query = terms.slice(0, 4).join(" ");

  const results = await Promise.allSettled([
    fetchHN(query, kw, sinceTs),
    fetchProductHunt(kw),
    fetchGoogleNews(name, kw),
    fetchDevTo(kw, sinceTs),
    fetchReddit(query, kw),
  ]);

  const items: NewsItem[] = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap(r => r.value);

  const deduped = dedup(items);

  const { data: cj, error } = await c.from("jobs").insert({
    type: "top_post_cluster",
    company_id: job.company_id,
    payload: { items: deduped, scrape_job_id: job.id },
    depends_on: [job.id],
  }).select().single();

  if (error) throw new Error(error.message);

  return { items_found: deduped.length, cluster_job_id: cj?.id };
}

async function fetchHN(query: string, kw: string[], sinceTs: number): Promise<NewsItem[]> {
  const u = new URL("https://hn.algolia.com/api/v1/search");
  u.searchParams.set("query", query);
  u.searchParams.set("tags", "story");
  u.searchParams.set("numericFilters", `points>=10,created_at_i>${sinceTs}`);
  u.searchParams.set("hitsPerPage", String(MAX_PER_SOURCE));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HN: ${r.status}`);
  const hits = (await r.json()).hits ?? [];
  return hits
    .filter((h: any) => matchesKw(h.title, kw))
    .map((h: any): NewsItem => ({
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source_name: "Hacker News",
      source_tier: 2,
      published_at: h.created_at,
      score: h.points ?? 0,
      raw: { source_type: "hackernews", comments: h.num_comments, hn_id: h.objectID },
    }));
}

async function fetchProductHunt(kw: string[]): Promise<NewsItem[]> {
  const xml = await fetchRss("https://www.producthunt.com/feed");
  return parseRss(xml, "Product Hunt", 2)
    .filter(i => matchesKw(i.title, kw))
    .slice(0, MAX_PER_SOURCE);
}

async function fetchGoogleNews(name: string, kw: string[]): Promise<NewsItem[]> {
  const terms = [name, ...kw.slice(0, 2)].filter(Boolean).join(" OR ");
  const q = encodeURIComponent(terms);
  const url = `https://news.google.com/rss/search?q=${q}&tbs=qdr:w&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchRss(url);
  return parseRss(xml, "Google News", 2).slice(0, MAX_PER_SOURCE);
}

async function fetchDevTo(kw: string[], sinceTs: number): Promise<NewsItem[]> {
  if (kw.length === 0) return [];
  const tag = kw[0].toLowerCase().replace(/\s+/g, "");
  const xml = await fetchRss(`https://dev.to/feed/tag/${tag}`);
  const since = new Date(sinceTs * 1000);
  return parseRss(xml, "Dev.to", 3)
    .filter(i => !i.published_at || new Date(i.published_at) >= since)
    .slice(0, MAX_PER_SOURCE);
}

async function fetchReddit(query: string, kw: string[]): Promise<NewsItem[]> {
  const q = encodeURIComponent(query);
  const url = `https://www.reddit.com/search.json?q=${q}&sort=top&t=week&limit=25`;
  const r = await fetch(url, { headers: { "user-agent": "berlin-saas-bot/1.0" } });
  if (!r.ok) throw new Error(`Reddit: ${r.status}`);
  const data = await r.json();
  const posts = (data?.data?.children ?? []) as any[];
  return posts
    .filter(p => p.data.score >= 20 && matchesKw(p.data.title, kw))
    .map((p): NewsItem => ({
      title: p.data.title,
      url: p.data.url ?? `https://reddit.com${p.data.permalink}`,
      source_name: `Reddit r/${p.data.subreddit}`,
      source_tier: 2,
      published_at: new Date(p.data.created_utc * 1000).toISOString(),
      score: p.data.score,
      raw: { source_type: "reddit", subreddit: p.data.subreddit, comments: p.data.num_comments },
    }));
}

async function fetchRss(url: string): Promise<string> {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { "user-agent": "berlin-saas-bot/1.0" }, signal: ac.signal });
    clearTimeout(tm);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return await r.text();
  } catch (e) {
    clearTimeout(tm);
    throw e;
  }
}

function parseRss(xml: string, sourceName: string, tier: 1 | 2 | 3): NewsItem[] {
  const items: NewsItem[] = [];
  const ER = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
  const TR = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const LR = /<link[^>]*?(?:href="([^"]+)"|>([^<]+)<\/link>)/i;
  const DR = /<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i;
  for (const b of xml.match(ER) ?? []) {
    const t = b.match(TR)?.[1]?.trim() ?? "";
    const lm = b.match(LR);
    const u = (lm?.[1] ?? lm?.[2] ?? "").trim();
    const ds = b.match(DR)?.[2]?.trim();
    if (!t || !u) continue;
    items.push({ title: t, url: u, source_name: sourceName, source_tier: tier, published_at: ds ? iso(ds) : null, score: null, raw: { source_type: "rss" } });
  }
  return items;
}

function matchesKw(text: string, kw: string[]): boolean {
  if (kw.length === 0) return true;
  const t = text.toLowerCase();
  return kw.some(k => t.includes(k.toLowerCase()));
}

function dedup(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(i => {
    const k = i.url.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 100);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function iso(s: string): string | null {
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; }
}
