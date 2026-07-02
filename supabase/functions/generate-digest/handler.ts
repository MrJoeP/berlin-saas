// Bot: Clustering der News-Items, Deep-Synthesis pro Cluster via Opus 4.8.
// Triggert: nach niche_news_scrape.
// Schreibt: digests (mit cluster_analyses jsonb), digest_items, knowledge_entries.
//
// Pipeline:
//   1. Haiku clustert die Items thematisch (max 20 Cluster).
//   2. Pro Cluster: Top-Article-Bodies fetchen (mit DB-Cache).
//   3. Trend-Memory aus knowledge_entries der letzten 4 Wochen lookuppen.
//   4. Opus 4.8 generiert pro Cluster strukturierte Deep-Analyse mit
//      cached system prompt. Parallel via Promise.all.
//   5. cluster_analyses als jsonb in digests, plus digest_items + knowledge_entries.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Company, DigestCluster, Job, NewsItem } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";
import { fetchArticleBody } from "../_shared/article_body.ts";
import {
  type ClusterSignalMetrics,
  computeConfidence,
  computeSignalMetrics,
  type Confidence,
  countTrendStreak,
  prepareClusters,
  type TrendMemoryEntry,
} from "../_shared/digest_quality.ts";
import {
  interestPromptNote,
  loadClusterVoteSignals,
  loadRelevanceProfile,
  type RelevanceProfile,
} from "../_shared/relevance.ts";

const CLUSTERING_PROMPT =
  `Du erhältst eine Liste von News-Items aus verschiedenen Quellen mit Quellen-Tier (1=Primärquelle, 2=Editorial, 3=Community).

Clustere die Items nach inhaltlichen Themen. 10 bis 20 Cluster (je mehr unterschiedliche Themen es gibt, desto mehr Cluster). Priorisiere Themen mit Tier-1- oder Tier-2-Quellen. Bevorzuge feinere Themen-Trennung — lieber zwei spezifische Cluster als einen breiten. Items mit nicht eindeutigem Theme oder reines Off-Topic-Geschnatter weglassen.

Antworte nur mit JSON:
{
  "clusters": [
    { "cluster_name": "Kurzer Theme-Name", "item_indices": [0, 3, 5] }
  ]
}`;

interface ClusterAnalysis {
  cluster_name: string;
  confidence: Confidence;
  confidence_reason: string;
  signal_metrics: ClusterSignalMetrics;
  was_passiert: string;
  warum_relevant: string;
  einordnung: string;
  next_move: string;
  offene_fragen: string[];
  key_quotes: { quote: string; source: string; url: string }[];
  trend_streak: number;
}

export async function handle(
  job: Job,
  client: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) {
    throw new Error("niche_news_cluster benötigt company_id.");
  }
  // deno-lint-ignore no-explicit-any
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) {
    return { message: "Keine Items, kein Digest erzeugt." };
  }

  const { data: company, error: companyErr } = await client
    .from("companies").select("*").eq("id", job.company_id).single();
  if (companyErr || !company) {
    throw new Error(`Company ${job.company_id} nicht gefunden.`);
  }

  // 1. Clustering via Haiku (deterministisch, günstig).
  // Gelerntes Profil (Item-Votes) liefert Interessens-Hinweise für den Prompt;
  // Cluster-Votes (decayed, company-scoped) gewichten das Cluster-Ranking.
  const relevanceProfile = await loadRelevanceProfile(
    client,
    company.id,
    "niche_news",
  );
  const rawClusters = await clusterItems(items, company, relevanceProfile);
  const voteSignals = await loadClusterVoteSignals(
    client,
    company.id,
    "niche_news",
  );
  const clusters = prepareClusters(rawClusters, voteSignals).slice(0, 20);
  if (clusters.length === 0) {
    return { message: "Keine validen Cluster, kein Digest erzeugt." };
  }

  // 2. Trend-Memory: letzte 4 Wochen knowledge_entries für Cross-Temporal Context.
  const trendMemory = await loadTrendMemory(client, company.id);

  // 3. Pro Cluster: Bodies fetchen + Deep-Synthesis (parallel).
  // WICHTIG: Pro-Cluster try/catch. Ein einzelner fehlgeschlagener Cluster (z.B. JSON-Parse-Fehler
  // der Synthese) darf NICHT den ganzen Digest killen. Fallback: Cluster bleibt erhalten,
  // was_passiert wird aus den Titeln zusammengesetzt, key_quotes leer.
  const analyses = await Promise.all(
    clusters.map(async (cluster) => {
      const confidence = computeConfidence(cluster.items);
      const trendStreak = countTrendStreak(cluster.cluster_name, trendMemory);
      const signalMetrics = computeSignalMetrics(
        cluster,
        company,
        trendStreak,
        voteSignals,
      );
      try {
        const bodies = await fetchTopBodies(cluster.items, client);
        const analysis = await deepSynthesize(
          cluster,
          company,
          bodies,
          trendStreak,
          trendMemory,
          signalMetrics,
        );
        return {
          ...analysis,
          cluster_name: cluster.cluster_name,
          confidence: confidence.confidence,
          confidence_reason: confidence.reason,
          signal_metrics: signalMetrics,
          trend_streak: trendStreak,
        } as ClusterAnalysis;
      } catch (err) {
        console.error(
          `deepSynthesize failed for cluster "${cluster.cluster_name}":`,
          err,
        );
        return {
          cluster_name: cluster.cluster_name,
          was_passiert: cluster.items.slice(0, 6).map((i) => i.title).join(
            " · ",
          ),
          warum_relevant: signalMetrics.signal_reason,
          einordnung: fallbackEinordnung(signalMetrics),
          next_move: fallbackNextMove(signalMetrics),
          offene_fragen: [],
          key_quotes: [],
          confidence: confidence.confidence,
          confidence_reason: confidence.reason,
          signal_metrics: signalMetrics,
          trend_streak: trendStreak,
        } as ClusterAnalysis;
      }
    }),
  );

  // 4. Digest persisten.
  const title = `Niche-News-Digest, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: digest, error: digestErr } = await client
    .from("digests")
    .insert({
      company_id: company.id,
      type: "niche_news",
      title,
      cluster_analyses: analyses,
    })
    .select()
    .single();
  if (digestErr || !digest) {
    throw new Error(`Digest insert failed: ${digestErr?.message}`);
  }

  // 5. digest_items pro Item.
  const digestItems = clusters.flatMap((cluster) => {
    const analysis = analyses.find((a) =>
      a.cluster_name === cluster.cluster_name
    );
    return cluster.items.map((item) => ({
      digest_id: digest.id,
      cluster: cluster.cluster_name,
      title: item.title,
      summary: analysis?.was_passiert ?? "",
      source_url: item.url,
      source_name: item.source_name,
      source_tier: item.source_tier ?? 3,
      cluster_confidence: analysis?.confidence,
      published_at: item.published_at,
      raw_json: item.raw,
    }));
  });
  if (digestItems.length > 0) {
    const { error: itemsErr } = await client.from("digest_items").insert(
      digestItems,
    );
    if (itemsErr) {
      throw new Error(`digest_items insert failed: ${itemsErr.message}`);
    }
  }

  // 6. knowledge_entries für Cross-Temporal Future-Lookup.
  const knowledgeEntries = analyses.map((a) => ({
    company_id: company.id,
    type: "niche_trend",
    content: `${a.cluster_name}: ${a.was_passiert}`,
    metadata: {
      digest_id: digest.id,
      cluster_name: a.cluster_name,
      confidence: a.confidence,
      signal_metrics: a.signal_metrics,
    },
  }));
  if (knowledgeEntries.length > 0) {
    const { error: knErr } = await client.from("knowledge_entries").insert(
      knowledgeEntries,
    );
    if (knErr) console.error("knowledge_entries insert failed:", knErr.message);
  }

  return {
    digest_id: digest.id,
    clusters: analyses.length,
    items_total: digestItems.length,
    bodies_fetched: analyses.length * 3,
    confidence_breakdown: analyses.reduce<Record<Confidence, number>>(
      (acc, a) => ({ ...acc, [a.confidence]: (acc[a.confidence] ?? 0) + 1 }),
      { verified: 0, editorial: 0, community: 0 },
    ),
  };
}

async function clusterItems(
  items: NewsItem[],
  company: Company,
  profile: RelevanceProfile,
): Promise<DigestCluster[]> {
  const itemsList = items
    .map((item, idx) =>
      `[${idx}] T${item.source_tier ?? 3} | ${item.title} (${item.source_name})`
    )
    .join("\n");
  const result = await callClaudeJSON<
    { clusters: { cluster_name: string; item_indices: number[] }[] }
  >({
    model: DEFAULT_MODEL,
    system: CLUSTERING_PROMPT,
    messages: [{
      role: "user",
      content: `Industrie: ${company.industry}\nNische: ${
        company.niche ?? ""
      }\nKeywords: ${company.keywords.join(", ")}${
        interestPromptNote(profile)
      }\n\nItems:\n${itemsList}`,
    }],
    max_tokens: 4000,
  });
  return result.clusters.map((c) => ({
    cluster_name: c.cluster_name,
    items: c.item_indices.map((idx) => items[idx]).filter(Boolean),
  }));
}

// Trend-Memory: alle Cluster-Namen aus knowledge_entries der letzten 4 Wochen.
async function loadTrendMemory(
  client: SupabaseClient,
  companyId: string,
): Promise<TrendMemoryEntry[]> {
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client
    .from("knowledge_entries")
    .select("metadata, created_at")
    .eq("company_id", companyId)
    .eq("type", "niche_trend")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (!data) return [];
  return data
    // deno-lint-ignore no-explicit-any
    .map((row: any) => {
      const name = row.metadata?.cluster_name as string | undefined;
      if (!name) return null;
      const weeksAgo = Math.floor(
        (Date.now() - new Date(row.created_at).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );
      return { cluster_name: name, weeks_ago: weeksAgo };
    })
    .filter((x): x is { cluster_name: string; weeks_ago: number } =>
      x !== null
    );
}

// Top-3-Items pro Cluster (T1 vor T2 vor T3, dann Score, dann Datum) — Bodies fetchen.
async function fetchTopBodies(
  items: NewsItem[],
  client: SupabaseClient,
): Promise<{ item: NewsItem; body: string | null }[]> {
  const sorted = [...items].sort((a, b) => {
    if (a.source_tier !== b.source_tier) return a.source_tier - b.source_tier;
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime();
  });
  const top = sorted.slice(0, 12);
  return await Promise.all(
    top.map(async (item) => ({
      item,
      body: await fetchArticleBody(
        item.url,
        client,
        item.source_name,
        item.title,
      ),
    })),
  );
}

// Haiku Deep-Synthesis pro Cluster — on mass (billig, daher viele Cluster + lange Outputs).
async function deepSynthesize(
  cluster: DigestCluster,
  company: Company,
  bodies: { item: NewsItem; body: string | null }[],
  trendStreak: number,
  trendMemory: TrendMemoryEntry[],
  signalMetrics: ClusterSignalMetrics,
): Promise<
  Omit<
    ClusterAnalysis,
    | "cluster_name"
    | "confidence"
    | "confidence_reason"
    | "signal_metrics"
    | "trend_streak"
  >
> {
  const systemPrompt =
    `Du bist ein investigativer Journalist der Industry-Briefings auf Faktenbasis verfasst.

Stil:
- Faktisch, präzise, neutral. Keine Marketing-Sprache, kein KI-Klang.
- Zitiere wörtlich aus Originalquellen (mit Source-Name).
- WICHTIG: Erfinde KEINE Zitate. Wenn kein wörtliches Zitat im Volltext steht, lass das key_quotes-Array leer.
- Trenne Fakten, Einordnung und offene Unsicherheiten.
- next_move ist keine aggressive Empfehlung, sondern eine knappe sinnvolle Einordnung: beobachten, testen, Content-Idee prüfen, oder ignorieren.

Company-Profil:
- Firma: ${company.name}
- Produkt: ${company.product_description ?? company.tagline ?? "unbekannt"}
- ICP: ${company.icp ?? "unbekannt"}
- Zielmarkt: ${company.target_market ?? "unbekannt"}
- Industrie: ${company.industry}
- Nische: ${company.niche ?? "unbekannt"}
- Keywords: ${company.keywords.join(", ")}
- Negative Keywords: ${(company.negative_keywords ?? []).join(", ")}

Output-Schema (strikt JSON, keine Prosa drumherum):
{
  "was_passiert": "5-8 Sätze: was ist die Kernnachricht. Konkret mit Datum, Zahlen, beteiligte Akteure, technische Details. Keine Interpretation.",
  "warum_relevant": "2-4 Sätze: warum dieses Signal für die Firma/Nische relevant oder irrelevant sein kann. Kontext nutzen, aber nicht übertreiben.",
  "einordnung": "1-3 Sätze: Fakt vs. Spekulation, Evidenzlage, ob es eher Trend, Einzelereignis oder Rauschen ist.",
  "next_move": "Ein kurzer, konkreter nächster Umgang mit dem Signal: beobachten, testen, Content daraus prüfen, oder ignorieren.",
  "offene_fragen": ["Max 3 offene Punkte, die zur sicheren Bewertung fehlen"],
  "key_quotes": [
    { "quote": "Exakt aus dem Volltext kopiert, unter 30 Wörtern", "source": "Source-Name", "url": "Source-URL" }
  ]
}`;

  // User-Prompt: Cluster-Details, alle Items mit Tier, plus Article-Bodies der Top-3.
  const allItemsList = cluster.items
    .map((i) =>
      `- T${i.source_tier ?? 3} | ${i.title} | ${i.source_name} | ${i.url}`
    )
    .join("\n");

  const bodyExcerpts = bodies
    .filter((b) => b.body)
    .map((b) =>
      `### ${b.item.source_name}: ${b.item.title}\nURL: ${b.item.url}\n\n${
        b.body!.slice(0, 6000)
      }`
    )
    .join("\n\n---\n\n");

  const trendNote = trendStreak >= 2
    ? `\n\nTrend-Memory: Dieses Thema (oder Verwandtes) erscheint die ${trendStreak}. Woche in Folge. Erwähne das im "warum_relevant" wenn passend.`
    : trendMemory.length > 0
    ? `\n\nLetzte Wochen-Themen (zur Differenzierung): ${
      trendMemory.slice(0, 5).map((m) => m.cluster_name).join("; ")
    }`
    : "";

  const userPrompt = `Cluster: ${cluster.cluster_name}
Anzahl Items: ${cluster.items.length}
Signal-Metriken:
- Priorität: ${signalMetrics.priority_score}/100
- Relevanz: ${signalMetrics.relevance_score}/100
- Evidenz: ${signalMetrics.evidence_score}/100
- Momentum: ${signalMetrics.momentum_score}/100
- Neuheit: ${signalMetrics.novelty_score}/100
- Quellenmix: ${signalMetrics.primary_source_count} T1, ${signalMetrics.editorial_source_count} T2, ${signalMetrics.community_source_count} T3
- Heuristische Einordnung: ${signalMetrics.action_hint}
- Grund: ${signalMetrics.signal_reason}
${trendNote}

Alle Items:
${allItemsList}

Volltext der Top-Quellen:
${bodyExcerpts || "(keine Volltexte verfügbar — synthetisiere aus Titeln)"}`;

  return await callClaudeJSON<
    Omit<ClusterAnalysis, "cluster_name" | "confidence" | "trend_streak">
  >({
    model: DEFAULT_MODEL,
    system: systemPrompt,
    cacheSystem: true,
    messages: [{ role: "user", content: userPrompt }],
    max_tokens: 8000,
    temperature: 0,
  });
}

function fallbackEinordnung(metrics: ClusterSignalMetrics): string {
  if (metrics.evidence_score >= 70) {
    return "Mehrere stärkere Quellen stützen dieses Signal.";
  }
  if (
    metrics.community_source_count >
      metrics.primary_source_count + metrics.editorial_source_count
  ) {
    return "Aktuell vor allem Community-Signal; als Hypothese behandeln.";
  }
  return "Signal ist verwertbar, aber die Quellenlage ist noch begrenzt.";
}

function fallbackNextMove(metrics: ClusterSignalMetrics): string {
  switch (metrics.action_hint) {
    case "act":
      return "Kurz intern prüfen und entscheiden, ob ein kleiner Test sinnvoll ist.";
    case "content":
      return "Als mögliche Content- oder Messaging-Idee vormerken.";
    case "watch":
      return "Weiter beobachten und beim nächsten Digest auf Wiederholung prüfen.";
    case "ignore":
      return "Vorerst ignorieren, außer es taucht erneut mit stärkerer Evidenz auf.";
  }
}
