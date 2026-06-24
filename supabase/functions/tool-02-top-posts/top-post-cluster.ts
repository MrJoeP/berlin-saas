import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Company, Job, NewsItem } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

interface PublishedContentItem {
  title: string;
  url: string;
  score: number | null;
  source: string;
  published_at: string | null;
  summary: string;
  why_relevant: string;
  strategic_value: string;
  key_takeaways: string[];
}

interface PublishedContentCluster {
  topic_name: string;
  content_type: "top_articles";
  source_mix: string[];
  summary: string;
  why_relevant: string;
  key_takeaways: string[];
  published_items: PublishedContentItem[];
}

interface TopPostVoteSignals {
  byUrl: Map<string, number>;
  bySource: Map<string, number>;
}

const SYNTH_PROMPT = `Du bist ein präziser Industry-Briefing-Redakteur.
Du fasst einen veröffentlichten Artikel, Beitrag oder Launch-Post inhaltlich zusammen.
Analysiere NICHT, warum etwas viral ging. Gib KEINE Hook- oder Copywriting-Beratung.
Erfinde keine Details, die nicht aus Titel, Quelle, URL oder Exzerpt ableitbar sind.

Firma: {company}
Industrie: {industry}
Nische: {niche}
Produkt: {product}
ICP: {icp}

Antworte JSON:
{
  "summary": "3-5 Sätze: worum es in diesem konkreten veröffentlichten Inhalt geht",
  "why_relevant": "1-3 Sätze: warum dieser Inhalt für Firma, Industrie oder ICP relevant sein kann",
  "strategic_value": "1 konkreter Mehrwert: welche Produkt-, Content-, Sales- oder Marktbeobachtung daraus abgeleitet werden kann",
  "key_takeaways": ["3-5 kurze Takeaways aus dem Inhalt"]
}`;

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) return { message: "keine items" };

  const { data: co } = await c.from("companies").select("*").eq(
    "id",
    job.company_id,
  ).single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const voteSignals = await loadVoteSignals(c, job.company_id);
  const topItems = selectTopItems(items, 10, voteSignals);
  const summarizedItems = await Promise.all(
    topItems.map((item) => summarizeItem(item, co as Company)),
  );

  const sourceMix = [...new Set(topItems.map((item) => item.source_name))];
  const contentClusters: PublishedContentCluster[] = [
    {
      topic_name: "Top 10 veröffentlichte Artikel & Beiträge",
      content_type: "top_articles",
      source_mix: sourceMix,
      summary: summarizedItems
        .map((item, idx) => `${idx + 1}. ${item.title}: ${item.summary}`)
        .join("\n"),
      why_relevant:
        "Diese zehn Inhalte sind die stärksten aktuell gefundenen Veröffentlichungen nach Score, Quellenqualität und Aktualität.",
      key_takeaways: summarizedItems.flatMap((item) => item.key_takeaways)
        .slice(0, 10),
      published_items: summarizedItems,
    },
  ];

  const title = `Top-10-Artikel-Briefing, ${
    new Date().toLocaleDateString("de-DE")
  }`;
  const { data: digest, error: digestErr } = await c.from("digests").insert({
    company_id: co.id,
    type: "top_post",
    title,
    cluster_analyses: contentClusters,
  }).select().single();
  if (digestErr || !digest) throw new Error(`digest: ${digestErr?.message}`);

  const digestItems = summarizedItems.map((item) => {
    const original = topItems.find((candidate) => candidate.url === item.url);
    return {
      digest_id: digest.id,
      cluster: "Top 10 veröffentlichte Artikel & Beiträge",
      title: item.title,
      summary: item.summary,
      source_url: item.url,
      source_name: item.source,
      source_tier: original?.source_tier ?? null,
      published_at: item.published_at,
      raw_json: {
        ...(original?.raw ?? {}),
        score: item.score,
        why_relevant: item.why_relevant,
        strategic_value: item.strategic_value,
        key_takeaways: item.key_takeaways,
      },
    };
  });

  if (digestItems.length > 0) {
    const { error: itemsErr } = await c.from("digest_items").insert(
      digestItems,
    );
    if (itemsErr) throw new Error(itemsErr.message);
  }

  return {
    digest_id: digest.id,
    top_articles: summarizedItems.length,
    items_total: digestItems.length,
  };
}

async function loadVoteSignals(
  c: SupabaseClient,
  companyId: string,
): Promise<TopPostVoteSignals> {
  const byUrl = new Map<string, number>();
  const bySource = new Map<string, number>();

  const { data: digests, error: digestErr } = await c
    .from("digests")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "top_post")
    .order("generated_at", { ascending: false })
    .limit(20);
  if (digestErr || !digests?.length) return { byUrl, bySource };

  const digestIds = digests.map((digest) => digest.id);
  const { data: items, error: itemErr } = await c
    .from("digest_items")
    .select("id, source_url, source_name")
    .in("digest_id", digestIds);
  if (itemErr || !items?.length) return { byUrl, bySource };

  const itemById = new Map<
    string,
    { source_url: string | null; source_name: string | null }
  >();
  for (
    const item of items as {
      id: string;
      source_url: string | null;
      source_name: string | null;
    }[]
  ) {
    itemById.set(item.id, {
      source_url: item.source_url,
      source_name: item.source_name,
    });
  }

  const { data: votes, error: voteErr } = await c
    .from("votes")
    .select("target_id, value")
    .eq("target_type", "item")
    .in("target_id", [...itemById.keys()]);
  if (voteErr || !votes?.length) return { byUrl, bySource };

  for (const vote of votes as { target_id: string; value: number }[]) {
    const item = itemById.get(vote.target_id);
    if (!item) continue;
    const urlKey = normalizeUrl(item.source_url);
    if (urlKey) byUrl.set(urlKey, (byUrl.get(urlKey) ?? 0) + vote.value);
    if (item.source_name) {
      bySource.set(
        item.source_name,
        (bySource.get(item.source_name) ?? 0) + vote.value,
      );
    }
  }

  return { byUrl, bySource };
}

function selectTopItems(
  items: NewsItem[],
  limit: number,
  voteSignals: TopPostVoteSignals,
): NewsItem[] {
  return [...items]
    .sort((a, b) => itemRank(b, voteSignals) - itemRank(a, voteSignals))
    .slice(0, limit);
}

function itemRank(item: NewsItem, voteSignals: TopPostVoteSignals): number {
  const score = item.score ?? 0;
  const tierBoost = item.source_tier === 1
    ? 60
    : item.source_tier === 2
    ? 35
    : 10;
  const ageBoost = recencyBoost(item.published_at);
  const urlVoteBoost = (voteSignals.byUrl.get(normalizeUrl(item.url)) ?? 0) *
    25;
  const sourceVoteBoost = (voteSignals.bySource.get(item.source_name) ?? 0) *
    6;
  return score + tierBoost + ageBoost + urlVoteBoost + sourceVoteBoost;
}

function recencyBoost(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 10;
  const ageDays = ageMs / 86_400_000;
  return Math.max(0, 14 - ageDays * 2);
}

function normalizeUrl(url: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

async function summarizeItem(
  item: NewsItem,
  co: Company,
): Promise<PublishedContentItem> {
  try {
    const synth = await synthItem(item, co);
    return {
      title: item.title,
      url: item.url,
      score: item.score,
      source: item.source_name,
      published_at: item.published_at,
      ...synth,
    };
  } catch (err) {
    console.error("top-post item synth failed " + item.title, err);
    return {
      title: item.title,
      url: item.url,
      score: item.score,
      source: item.source_name,
      published_at: item.published_at,
      summary: item.title,
      why_relevant: "",
      strategic_value: "",
      key_takeaways: [],
    };
  }
}

async function synthItem(item: NewsItem, co: Company) {
  const excerpt = typeof item.raw?.description === "string"
    ? item.raw.description
    : typeof item.raw?.excerpt === "string"
    ? item.raw.excerpt
    : "";
  const system = SYNTH_PROMPT
    .replace(/{company}/g, co.name ?? co.url ?? "")
    .replace("{industry}", co.industry ?? "")
    .replace("{niche}", co.niche ?? "")
    .replace("{product}", co.product_description ?? co.tagline ?? "")
    .replace("{icp}", co.icp ?? "");
  return await callClaudeJSON<
    {
      summary: string;
      why_relevant: string;
      strategic_value: string;
      key_takeaways: string[];
    }
  >({
    model: DEFAULT_MODEL,
    system,
    messages: [{
      role: "user",
      content: `Titel: ${item.title}\nQuelle: ${item.source_name}\nScore: ${
        item.score ?? "n/a"
      }\nDatum: ${
        item.published_at ?? "kein Datum"
      }\nURL: ${item.url}\nExzerpt: ${excerpt}`,
    }],
    max_tokens: 1000,
    temperature: 0,
  });
}
