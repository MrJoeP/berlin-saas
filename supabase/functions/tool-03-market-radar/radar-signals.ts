// radar_signals: Mentions je Entität einsammeln (HN + Reddit), nur für
// competitor/substitute (Komplement-Riesen fluten). Schnittmengen-Filter mit
// Company-Keywords, Cap 5 pro Entität, Dedup 14 Tage. Chained radar_digest.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

const MENTION_CAP_PER_ENTITY = 5;
const DEDUP_DAYS = 14;
const WINDOW_DAYS = 7;

interface RadarEntityRow {
  id: string;
  name: string;
  type: "competitor" | "substitute" | "complement";
  aliases: string[];
  keywords: string[];
}

interface MentionCandidate {
  entity: RadarEntityRow;
  title: string;
  url: string;
  sourceName: string;
  score: number;
  publishedAt: string | null;
  excerpt: string;
}

interface MentionAnalysis {
  index: number;
  keep: boolean;
  why_it_matters: string;
  next_step: string;
  severity: number;
}

const MENTION_PROMPT = `Du bewertest Social-Mentions von Markt-Akteuren.
Kontext: Unsere Firma "{company}" ({product}). ICP: {icp}.

Pro Mention: keep=false wenn belanglos (Namensdopplung, Off-Topic, reiner Support-Thread).
Severity: 2 = erwähnenswert, 3 = deutliches Stimmungs-/Traktions-Signal,
4 = öffentliche Schwäche eines Akteurs oder starker Wechsel-Diskurs, 5 = massiv.

Antworte ausschließlich JSON:
{"mentions": [{"index": 0, "keep": true, "why_it_matters": "1-2 Sätze Bezug auf uns",
  "next_step": "1 Satz", "severity": 2-5}]}`;

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");

  const { data: co } = await c
    .from("companies")
    .select("id, name, product_description, icp, keywords")
    .eq("id", job.company_id)
    .single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);
  const companyKeywords = ((co.keywords ?? []) as string[]).map((k) => k.toLowerCase());

  const { data: entities } = await c
    .from("entities")
    .select("id, name, type, aliases, keywords")
    .eq("company_id", job.company_id)
    .eq("active", true)
    .in("type", ["competitor", "substitute"]);

  // Dedup-Fenster: bereits gesehene URLs der letzten 14 Tage.
  const since = new Date(Date.now() - DEDUP_DAYS * 86_400_000).toISOString();
  const { data: recent } = await c
    .from("entity_signals")
    .select("source_url")
    .eq("company_id", job.company_id)
    .gte("detected_at", since);
  const seenUrls = new Set((recent ?? []).map((r) => normalizeUrl(r.source_url ?? "")));

  const candidates: MentionCandidate[] = [];
  for (const entity of ((entities ?? []) as RadarEntityRow[]).slice(0, 12)) {
    const names = [entity.name, ...(entity.aliases ?? [])].filter(Boolean);
    const results = await Promise.allSettled([
      fetchHNMentions(names[0]),
      fetchRedditMentions(names[0]),
    ]);
    const found = results
      .filter((r): r is PromiseFulfilledResult<Omit<MentionCandidate, "entity">[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      // Echter Namens-Match im Titel oder Auszug.
      .filter((m) => names.some((n) => `${m.title} ${m.excerpt}`.toLowerCase().includes(n.toLowerCase())))
      // Schnittmengen-Filter: Bezug zu unserem Feld, sonst ist es Rauschen.
      .filter((m) => intersectsKeywords(`${m.title} ${m.excerpt}`, companyKeywords, entity.keywords ?? []))
      .filter((m) => !seenUrls.has(normalizeUrl(m.url)))
      .sort((a, b) => b.score - a.score)
      .slice(0, MENTION_CAP_PER_ENTITY);
    for (const m of found) candidates.push({ ...m, entity });
  }

  let inserted = 0;
  if (candidates.length > 0) {
    const analyses = await analyzeMentions(co, candidates.slice(0, 30));
    for (const a of analyses) {
      const cand = candidates[a.index];
      if (!cand || !a.keep) continue;
      await c.from("entity_signals").insert({
        entity_id: cand.entity.id,
        company_id: job.company_id,
        signal_type: "mention",
        title: cand.title.slice(0, 300),
        body: cand.excerpt || cand.title,
        why_it_matters: a.why_it_matters ?? "",
        next_step: a.next_step ?? "",
        source_url: cand.url,
        source_name: cand.sourceName,
        lens: cand.entity.type,
        tags: ["mention"],
        payload: { engagement: cand.score, published_at: cand.publishedAt },
        severity: Math.max(1, Math.min(5, Math.round(a.severity || 2))),
        drift_score: 0,
        score: 0,
      });
      inserted++;
      seenUrls.add(normalizeUrl(cand.url));
    }
  }

  // Kette: Digest bauen, wartet auf Snapshot- UND Signals-Job.
  const snapshotJobId = job.payload?.snapshot_job_id as string | undefined;
  const dependsOn = [job.id, ...(snapshotJobId ? [snapshotJobId] : [])];
  const { data: nextJob, error } = await c.from("jobs").insert({
    type: "radar_digest",
    company_id: job.company_id,
    payload: { signals_job_id: job.id },
    depends_on: dependsOn,
  }).select().single();
  if (error) throw new Error(error.message);

  return { candidates: candidates.length, mentions_inserted: inserted, digest_job_id: nextJob?.id };
}

async function fetchHNMentions(name: string): Promise<Omit<MentionCandidate, "entity">[]> {
  const sinceTs = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;
  const u = new URL("https://hn.algolia.com/api/v1/search");
  u.searchParams.set("query", `"${name}"`);
  u.searchParams.set("tags", "story");
  u.searchParams.set("numericFilters", `points>=20,created_at_i>${sinceTs}`);
  u.searchParams.set("hitsPerPage", "10");
  const r = await fetch(u);
  if (!r.ok) return [];
  const hits = (await r.json()).hits ?? [];
  // deno-lint-ignore no-explicit-any
  return hits.map((h: any) => ({
    title: h.title ?? "",
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    sourceName: "Hacker News",
    score: h.points ?? 0,
    publishedAt: h.created_at ?? null,
    excerpt: h.story_text?.slice(0, 400) ?? "",
  }));
}

async function fetchRedditMentions(name: string): Promise<Omit<MentionCandidate, "entity">[]> {
  const q = encodeURIComponent(`"${name}"`);
  const url = `https://www.reddit.com/search.json?q=${q}&sort=top&t=week&limit=15`;
  const r = await fetch(url, { headers: { "user-agent": "berlin-saas-bot/1.0" } });
  if (!r.ok) return [];
  const data = await r.json();
  // deno-lint-ignore no-explicit-any
  const posts = (data?.data?.children ?? []) as any[];
  return posts
    .filter((p) => (p.data?.score ?? 0) >= 15)
    .map((p) => ({
      title: p.data.title ?? "",
      url: p.data.url ?? `https://reddit.com${p.data.permalink}`,
      sourceName: `Reddit r/${p.data.subreddit}`,
      score: p.data.score ?? 0,
      publishedAt: p.data.created_utc ? new Date(p.data.created_utc * 1000).toISOString() : null,
      excerpt: p.data.selftext?.slice(0, 400) ?? "",
    }));
}

async function analyzeMentions(
  co: { name: string | null; product_description: string | null; icp: string | null },
  candidates: MentionCandidate[],
): Promise<MentionAnalysis[]> {
  const system = MENTION_PROMPT
    .replace("{company}", co.name ?? "")
    .replace("{product}", co.product_description ?? "")
    .replace("{icp}", co.icp ?? "");
  const list = candidates
    .map((m, i) => `[${i}] Akteur: ${m.entity.name} (${m.entity.type}) | ${m.sourceName} | ▲${m.score}\n${m.title}\n${m.excerpt.slice(0, 200)}`)
    .join("\n\n");
  try {
    const result = await callClaudeJSON<{ mentions: MentionAnalysis[] }>({
      model: DEFAULT_MODEL,
      system,
      messages: [{ role: "user", content: list.slice(0, 9000) }],
      max_tokens: 1500,
      temperature: 0,
    });
    return result.mentions ?? [];
  } catch {
    // LLM-Ausfall: konservativ alles behalten mit Default-Severity.
    return candidates.map((_, i) => ({ index: i, keep: true, why_it_matters: "", next_step: "", severity: 2 }));
  }
}

function intersectsKeywords(text: string, companyKw: string[], entityKw: string[]): boolean {
  const pool = [...companyKw, ...entityKw.map((k) => k.toLowerCase())].filter(Boolean);
  if (pool.length === 0) return true;
  const t = text.toLowerCase();
  return pool.some((k) => t.includes(k));
}

function normalizeUrl(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}
