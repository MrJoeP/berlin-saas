import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem } from "../_shared/types.ts";

const MAX_PER_SOURCE = 50;

export async function handle(job: Job, c: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");
  const { data: co } = await c.from("companies").select("name, industry, niche, keywords").eq("id", job.company_id).single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const kw = (co.keywords ?? []) as string[];
  const name = co.name as string;
  const query = [name, ...kw.slice(0, 3)].filter(Boolean).join(" ");

  const results = await Promise.allSettled([
    fetchHN(query, kw),
    fetchProductHunt(kw),
    fetchLinkedInViaGoogle(name, kw),
    fetchDevTo(kw),
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

async function fetchHN(query: string, kw: string[]): Promise<NewsItem[]> {
  const u = new URL("https://hn.algolia.com/api/v1/search");
  u.searchParams.set("query", query);
  u.searchParams.set("tags", "story");
  u.searchParams.set("numericFilters", "points>=50");
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
  return parseRss(xml, "Product Hunt", 2).filter(i => matchesKw(i.title, kw)).slice(0, MAX_PER_SOURCE);
}

async function fetchLinkedInViaGoogle(name: string, kw: string[]): Promise<NewsItem[]> {
  const q = encodeURIComponent(`site:linkedin.com/posts "${name}" OR "${kw[0] ?? name}"`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchRss(url);
  return parseRss(xml, "LinkedIn (via Google)", 2).slice(0, MAX_PER_SOURCE);
}

async function fetchDevTo(kw: string[]): Promise<NewsItem[]> {
  if (kw.length === 0) return [];
  const tag = kw[0].toLowerCase().replace(/\s+/g, "");
  const xml = await fetchRss(`https://dev.to/feed/tag/${tag}`);
  return parseRss(xml, "Dev.to", 3).slice(0, MAX_PER_SOURCE);
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
