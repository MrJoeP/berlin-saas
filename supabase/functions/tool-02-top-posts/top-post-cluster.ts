import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Company, Job, NewsItem } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

interface PublishedContentItem {
  title: string;
  url: string;
  score: number | null;
  source: string;
  published_at: string | null;
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

const CLUSTER_PROMPT = `Du bist ein thematischer Analyst. Gruppiere die folgenden Artikel/Posts nach übergeordneten Themen.
Verwende 3-6 Themen, je nach Datenlage. Jeder Item-Index darf nur in einem Cluster vorkommen.
Ignoriere Duplikate oder sehr ähnliche Beiträge.

Antworte ausschließlich JSON:
{"clusters": [{"topic": "Thema-Name", "item_indices": [0, 3, 7]}]}`;

const SYNTH_PROMPT = `Du bist ein präziser Industry-Briefing-Redakteur.
Fasse die folgenden veröffentlichten Artikel/Posts zu einem Themen-Cluster zusammen.
Analysiere NICHT, warum etwas viral ging. Gib KEINE Hook-Beratung.
Beschreibe, was tatsächlich veröffentlicht wurde und warum es für die Firma relevant ist.

Firma: {company}
Industrie: {industry}
Nische: {niche}
Produkt: {product}
ICP: {icp}

Antworte JSON:
{
  "summary": "3-5 Sätze: Was wurde in diesem Themenbereich veröffentlicht?",
  "why_relevant": "1-3 Sätze: Warum ist das für diese Firma oder ihren ICP relevant?",
  "key_takeaways": ["3-5 konkrete Erkenntnisse aus den Inhalten"]
}`;

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) return { message: "keine items" };

  const { data: co } = await c.from("companies").select("*").eq("id", job.company_id).single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  // Top 30 by combined rank (score + tier + recency)
  const topItems = [...items]
    .sort((a, b) => itemRank(b) - itemRank(a))
    .slice(0, 30);

  // Step 1: Cluster by topic
  const clusters = await clusterByTopic(topItems);

  // Step 2: Synthesize each cluster in parallel
  const contentClusters: PublishedContentCluster[] = (
    await Promise.all(
      clusters.map(async (cluster) => {
        const clusterItems = cluster.item_indices
          .filter(i => i < topItems.length)
          .map(i => topItems[i]);

        if (clusterItems.length === 0) return null;

        const sourceMix = [...new Set(clusterItems.map(i => i.source_name))];
        const synth = await synthCluster(clusterItems, co as Company);

        const publishedItems: PublishedContentItem[] = clusterItems
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map(item => ({
            title: item.title,
            url: item.url,
            score: item.score,
            source: item.source_name,
            published_at: item.published_at,
          }));

        return {
          topic_name: cluster.topic,
          content_type: "top_articles" as const,
          source_mix: sourceMix,
          summary: synth.summary,
          why_relevant: synth.why_relevant,
          key_takeaways: synth.key_takeaways,
          published_items: publishedItems,
        };
      }),
    )
  ).filter(Boolean) as PublishedContentCluster[];

  const title = `Published Content Briefing, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: digest, error: digestErr } = await c.from("digests").insert({
    company_id: co.id,
    type: "top_post",
    title,
    cluster_analyses: contentClusters,
  }).select().single();
  if (digestErr || !digest) throw new Error(`digest: ${digestErr?.message}`);

  const digestItems = contentClusters.flatMap(cluster =>
    cluster.published_items.map(item => ({
      digest_id: digest.id,
      cluster: cluster.topic_name,
      title: item.title,
      summary: cluster.summary,
      source_url: item.url,
      source_name: item.source,
      source_tier: topItems.find(t => t.url === item.url)?.source_tier ?? null,
      published_at: item.published_at,
      raw_json: { score: item.score },
    }))
  );

  if (digestItems.length > 0) {
    const { error: itemsErr } = await c.from("digest_items").insert(digestItems);
    if (itemsErr) throw new Error(itemsErr.message);
  }

  return {
    digest_id: digest.id,
    clusters: contentClusters.length,
    total_items: digestItems.length,
  };
}

async function clusterByTopic(
  items: NewsItem[],
): Promise<{ topic: string; item_indices: number[] }[]> {
  const itemList = items
    .map((item, i) => `[${i}] ${item.source_name} | ▲${item.score ?? "?"} | ${item.title}`)
    .join("\n");

  try {
    const result = await callClaudeJSON<{ clusters: { topic: string; item_indices: number[] }[] }>({
      model: DEFAULT_MODEL,
      system: CLUSTER_PROMPT,
      messages: [{ role: "user", content: `Items:\n${itemList}` }],
      max_tokens: 1500,
      temperature: 0,
    });
    return result.clusters ?? [];
  } catch {
    return [{ topic: "Trending dieser Woche", item_indices: items.map((_, i) => i) }];
  }
}

async function synthCluster(items: NewsItem[], co: Company) {
  const itemList = items
    .map(item =>
      `- [${item.source_name} | ▲${item.score ?? "?"}] ${item.title}` +
      (item.raw?.excerpt ? `\n  ${String(item.raw.excerpt).slice(0, 300)}` : "")
    )
    .join("\n\n");

  const system = SYNTH_PROMPT
    .replace("{company}", co.name ?? co.url ?? "")
    .replace("{industry}", co.industry ?? "")
    .replace("{niche}", co.niche ?? "")
    .replace("{product}", co.product_description ?? co.tagline ?? "")
    .replace("{icp}", co.icp ?? "");

  try {
    return await callClaudeJSON<{ summary: string; why_relevant: string; key_takeaways: string[] }>({
      model: DEFAULT_MODEL,
      system,
      messages: [{ role: "user", content: `Veröffentlichte Inhalte:\n\n${itemList}` }],
      max_tokens: 1200,
      temperature: 0,
    });
  } catch {
    return { summary: items.map(i => i.title).join("; "), why_relevant: "", key_takeaways: [] };
  }
}

function itemRank(item: NewsItem): number {
  const score = item.score ?? 0;
  const tierBoost = item.source_tier === 1 ? 60 : item.source_tier === 2 ? 35 : 10;
  const ageBoost = recencyBoost(item.published_at);
  return score + tierBoost + ageBoost;
}

function recencyBoost(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 10;
  const ageDays = ageMs / 86_400_000;
  return Math.max(0, 14 - ageDays * 2);
}
