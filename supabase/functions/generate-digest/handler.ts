// Bot: Clustering der News-Items, Digest-Generierung, Knowledge-Base-Updates.
// Triggert: nach niche_news_scrape.
// Schreibt: digests, digest_items, knowledge_entries.
// Enqueued: niche_news_send.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, DigestCluster, Company } from "../_shared/types.ts";
import { callClaude, callClaudeJSON, SONNET_MODEL } from "../_shared/claude.ts";

const CLUSTERING_PROMPT = `Du erhältst eine Liste von News-Items aus verschiedenen Quellen.
Clustere sie nach Themen. Maximal 5 Cluster.

Antworte nur mit JSON in dem Format:
{
  "clusters": [
    {
      "cluster_name": "Kurzer Theme-Name, z.B. 'AI Funding'",
      "item_indices": [0, 3, 5]
    }
  ]
}

Items mit nicht eindeutigem Theme weglassen.`;

const SUMMARY_PROMPT = `Du schreibst einen kurzen Absatz (3 bis 4 Sätze) zu einem News-Cluster.
Zielgruppe ist ein Founder, der schnell den Punkt verstehen will.
Kein Marketing-Sprech, kein KI-Klang. Klar und scharf.

Items kommen als Input. Schreibe die Summary. Keine Aufzählung.`;

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("niche_news_cluster benötigt company_id.");

  // deno-lint-ignore no-explicit-any
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) {
    return { message: "Keine Items, kein Digest erzeugt." };
  }

  const { data: company, error: companyErr } = await client
    .from("companies")
    .select("*")
    .eq("id", job.company_id)
    .single();

  if (companyErr || !company) throw new Error(`Company ${job.company_id} nicht gefunden.`);

  // 1. Cluster die Items.
  const clusters = await clusterItems(items, company);

  // 2. Pro Cluster eine Summary schreiben.
  const enrichedClusters: DigestCluster[] = [];
  for (const cluster of clusters) {
    const summary = await summarizeCluster(cluster);
    enrichedClusters.push({ ...cluster, summary });
  }

  // 3. Digest in DB schreiben.
  const title = `Niche-News-Digest, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: digest, error: digestErr } = await client
    .from("digests")
    .insert({
      company_id: company.id,
      type: "niche_news",
      title,
    })
    .select()
    .single();

  if (digestErr || !digest) throw new Error(`Digest insert failed: ${digestErr?.message}`);

  // 4. Digest-Items.
  const digestItems = enrichedClusters.flatMap((cluster) =>
    cluster.items.map((item) => ({
      digest_id: digest.id,
      cluster: cluster.cluster_name,
      title: item.title,
      summary: cluster.summary ?? "",
      source_url: item.url,
      source_name: item.source_name,
      published_at: item.published_at,
      raw_json: item.raw,
    }))
  );

  if (digestItems.length > 0) {
    const { error: itemsErr } = await client.from("digest_items").insert(digestItems);
    if (itemsErr) throw new Error(`digest_items insert failed: ${itemsErr.message}`);
  }

  // 5. Cluster-Summaries als knowledge_entries für spätere Module.
  const knowledgeEntries = enrichedClusters.map((cluster) => ({
    company_id: company.id,
    type: "niche_trend",
    content: `${cluster.cluster_name}: ${cluster.summary}`,
    metadata: { digest_id: digest.id, cluster_name: cluster.cluster_name },
  }));

  if (knowledgeEntries.length > 0) {
    await client.from("knowledge_entries").insert(knowledgeEntries);
  }

  // 6. Send-Job enqueuen.
  const { data: sendJob } = await client
    .from("jobs")
    .insert({
      type: "niche_news_send",
      company_id: company.id,
      payload: { digest_id: digest.id },
      depends_on: [job.id],
    })
    .select()
    .single();

  return {
    digest_id: digest.id,
    clusters: enrichedClusters.length,
    items_total: digestItems.length,
    send_job_id: sendJob?.id,
  };
}

async function clusterItems(items: NewsItem[], company: Company): Promise<DigestCluster[]> {
  const itemsList = items
    .map((item, idx) => `[${idx}] ${item.title} (${item.source_name})`)
    .join("\n");

  const result = await callClaudeJSON<{ clusters: { cluster_name: string; item_indices: number[] }[] }>({
    model: SONNET_MODEL,
    system: CLUSTERING_PROMPT,
    messages: [
      {
        role: "user",
        content: `Industrie: ${company.industry}\nNische: ${company.niche ?? ""}\nKeywords: ${company.keywords.join(", ")}\n\nItems:\n${itemsList}`,
      },
    ],
    max_tokens: 2000,
  });

  return result.clusters.map((c) => ({
    cluster_name: c.cluster_name,
    items: c.item_indices.map((idx) => items[idx]).filter(Boolean),
  }));
}

async function summarizeCluster(cluster: DigestCluster): Promise<string> {
  const itemsText = cluster.items
    .map((item) => `- ${item.title} (${item.source_name})`)
    .join("\n");

  const result = await callClaude({
    system: SUMMARY_PROMPT,
    messages: [
      { role: "user", content: `Cluster: ${cluster.cluster_name}\n\n${itemsText}` },
    ],
    max_tokens: 300,
  });

  return result.content.trim();
}
