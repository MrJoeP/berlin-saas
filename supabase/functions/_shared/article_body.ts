// Article-Body-Fetcher mit DB-Cache.
// Holt den Volltext eines Artikels, cached in article_bodies (30 Tage TTL).
// Fallback: simple fetch + HTML strip wenn Firecrawl nicht konfiguriert.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CACHE_TTL_DAYS = 30;
const MAX_BODY_CHARS = 12000;
const FETCH_TIMEOUT_MS = 12000;

export async function fetchArticleBody(
  url: string,
  client: SupabaseClient,
  sourceName?: string,
  title?: string,
): Promise<string | null> {
  // 1. Cache prüfen.
  const { data: cached } = await client
    .from("article_bodies")
    .select("body, fetched_at")
    .eq("url", url)
    .single();

  if (cached) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < CACHE_TTL_DAYS) return cached.body;
  }

  // 2. Fetchen.
  let body: string;
  try {
    body = await fetchAndExtract(url);
  } catch (err) {
    console.warn(`article_body fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }

  if (!body || body.length < 200) return null;

  // 3. Cachen.
  await client.from("article_bodies").upsert({
    url,
    body: body.slice(0, MAX_BODY_CHARS),
    source_name: sourceName ?? null,
    title: title ?? null,
    fetched_at: new Date().toISOString(),
  });

  return body.slice(0, MAX_BODY_CHARS);
}

async function fetchAndExtract(url: string): Promise<string> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "content-type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!response.ok) throw new Error(`Firecrawl ${url} failed: ${response.status}`);
    const data = await response.json();
    const markdown = data.data?.markdown ?? "";
    if (markdown) return markdown;
  }

  // Fallback: simple fetch mit Timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "berlin-saas-bot/1.0",
        "accept": "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Fetch ${url} failed: ${response.status}`);
    const html = await response.text();
    return stripHtmlSimple(html);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function stripHtmlSimple(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
