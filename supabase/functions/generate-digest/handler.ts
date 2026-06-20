// Bot: Clustering der News-Items, Digest-Generierung, Knowledge-Base-Updates.
// Triggert: nach niche_news_scrape.
// Schreibt: digests, digest_items, knowledge_entries.
//
// Cluster-Confidence wird pro Cluster aus dem Tier-Mix der Items berechnet:
//   verified  = mind. 1 Tier-1-Quelle (Primärquelle, Hersteller)
//   editorial = mind. 2 Tier-2-Quellen (Industry-Pubs)
//   community = nur Tier-3-Quellen (Reddit, HN)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, DigestCluster, Company } from "../_shared/types.ts";
import { callClaude, callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

const CLUSTERING_PROMPT = `Du erhältst eine Liste von News-Items aus verschiedenen Quellen
mit Quellen-Tier (1=Primärquelle, 2=Editorial, 3=Community).

Clustere die Items nach inhaltlichen Themen. Maximal 6 Cluster.
Priorisiere Themen mit Tier-1- oder Tier-2-Quellen.
Items mit nicht eindeutigem Theme oder reines Off-Topic-Geschnatter weglassen.

Antworte nur mit JSON:
{
  "clusters": [
    { "cluster_name": "Kurzer Theme-Name", "item_indices": [0, 3, 5] }
  ]
}`;

const SUMMARY_PROMPT = `Du schreibst einen kurzen Absatz (3 bis 4 Sätze) zu einem News-Cluster.
Zielgruppe ist ein Founder. Kein Marketing-Sprech, kein KI-Klang. Klar und scharf. Keine Aufzählung.
Wenn der Cluster überwiegend aus Community-Quellen besteht, mach das klar im Ton ("Diskussion zeigt...", "in Foren wird debattiert...").`;

type Confidence = "verified" | "editorial" | "community";

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("niche_news_cluster benötigt company_id.");
  // deno-lint-ignore no-explicit-any
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) return { message: "Keine Items, kein Digest erzeugt." };

  const { data: company, error: companyErr } = await client
    .from("companies").select("*").eq("id", job.company_id).single();
  if (companyErr || !company) throw new Error(`Company ${job.company_id} nicht gefunden.`);

  const clusters = await clusterItems(items, company);
  const enrichedClusters = await Promise.all(
    clusters.map(async (cluster) => {
      const confidence = computeConfidence(cluster.items);
      const summary = await summarizeCluster(cluster, confidence);
      return { ...cluster, summary, confidence };
    }),
  );

  const title = `Niche-News-Digest, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: digest, error: digestErr } = await client
    .from("digests").insert({ company_id: company.id, type: "niche_news", title })
    .select().single();
  if (digestErr || !digest) throw new Error(`Digest insert failed: ${digestErr?.message}`);

  const digestItems = enrichedClusters.flatMap((cluster) =>
    cluster.items.map((item) => ({
      digest_id: digest.id,
      cluster: cluster.cluster_name,
      title: item.title,
      summary: cluster.summary ?? "",
      source_url: item.url,
      source_name: item.source_name,
      source_tier: item.source_tier ?? 3,
      cluster_confidence: cluster.confidence,
      published_at: item.published_at,
      raw_json: item.raw,
    }))
  );
  if (digestItems.length > 0) {
    const { error: itemsErr } = await client.from("digest_items").insert(digestItems);
    if (itemsErr) throw new Error(`digest_items insert failed: ${itemsErr.message}`);
  }

  const knowledgeEntries = enrichedClusters.map((cluster) => ({
    company_id: company.id,
    type: "niche_trend",
    content: `${cluster.cluster_name}: ${cluster.summary}`,
    metadata: {
      digest_id: digest.id,
      cluster_name: cluster.cluster_name,
      confidence: cluster.confidence,
    },
  }));
  if (knowledgeEntries.length > 0) {
    const { error: knowledgeErr } = await client.from("knowledge_entries").insert(knowledgeEntries);
    if (knowledgeErr) console.error("knowledge_entries insert failed:", knowledgeErr.message);
  }

  return {
    digest_id: digest.id,
    clusters: enrichedClusters.length,
    items_total: digestItems.length,
    confidence_breakdown: enrichedClusters.reduce<Record<Confidence, number>>(
      (acc, c) => ({ ...acc, [c.confidence]: (acc[c.confidence] ?? 0) + 1 }),
      { verified: 0, editorial: 0, community: 0 },
    ),
  };
}

function computeConfidence(items: NewsItem[]): Confidence {
  const t1 = items.filter((i) => i.source_tier === 1).length;
  const t2 = items.filter((i) => i.source_tier === 2).length;
  if (t1 >= 1) return "verified";
  if (t2 >= 2) return "editorial";
  return "community";
}

async function clusterItems(items: NewsItem[], company: Company): Promise<DigestCluster[]> {
  const itemsList = items
    .map((item, idx) => `[${idx}] T${item.source_tier ?? 3} | ${item.title} (${item.source_name})`)
    .join("\n");
  const result = await callClaudeJSON<{ clusters: { cluster_name: string; item_indices: number[] }[] }>({
    model: DEFAULT_MODEL,
    system: CLUSTERING_PROMPT,
    messages: [{
      role: "user",
      content: `Industrie: ${company.industry}\nNische: ${company.niche ?? ""}\nKeywords: ${company.keywords.join(", ")}\n\nItems:\n${itemsList}`,
    }],
    max_tokens: 2000,
  });
  return result.clusters.map((c) => ({
    cluster_name: c.cluster_name,
    items: c.item_indices.map((idx) => items[idx]).filter(Boolean),
  }));
}

async function summarizeCluster(cluster: DigestCluster, confidence: Confidence): Promise<string> {
  const itemsText = cluster.items
    .map((item) => `- T${item.source_tier ?? 3} | ${item.title} (${item.source_name})`)
    .join("\n");
  const result = await callClaude({
    system: SUMMARY_PROMPT,
    messages: [{
      role: "user",
      content: `Cluster: ${cluster.cluster_name}\nConfidence: ${confidence}\n\n${itemsText}`,
    }],
    max_tokens: 300,
  });
  return result.content.trim();
}
