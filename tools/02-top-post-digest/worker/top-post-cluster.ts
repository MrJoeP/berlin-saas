import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, Company } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

interface HookCluster {
  pattern_name: string;
  was_geht_viral: string;
  warum_es_funktioniert: string;
  beispiele: { title: string; url: string; score: number | null; source: string }[];
  winkel_fuer_eigenen_post: string;
}

interface TopPostDigestResult {
  hook_clusters: HookCluster[];
  top_format: string;
  summary: string;
}

const CLUSTER_PROMPT = `Du analysierst Top-Posts aus verschiedenen Plattformen und erkennst Muster.
Clustere die Posts nach Hook-Mustern. 4-8 Cluster. JSON:
{"clusters":[{"pattern_name":"...","item_indices":[0,2,5]}]}`;

const SYNTH_PROMPT = `Du bist ein Content-Stratege der analysiert warum Posts viral gehen.
Analysiere diese Posts aus demselben Cluster und extrahiere das Hook-Muster.
Firma: {company}
Industrie: {industry}

JSON:
{
  "was_geht_viral": "2-3 Saetze was diese Posts gemeinsam haben",
  "warum_es_funktioniert": "2-3 Saetze psychologische Erklaerung",
  "winkel_fuer_eigenen_post": "Konkrete Empfehlung wie man dieses Muster nutzt"
}`;

export async function handle(job: Job, c: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");
  const items = (job.payload.items ?? []) as NewsItem[];
  if (items.length === 0) return { message: "keine items" };

  const { data: co } = await c.from("companies").select("*").eq("id", job.company_id).single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const clusters = await clusterPosts(items, co as Company);

  const hookClusters = await Promise.all(
    clusters.map(async cl => {
      try {
        const synth = await synthCluster(cl.items, co as Company);
        return {
          pattern_name: cl.cluster_name,
          ...synth,
          beispiele: cl.items.slice(0, 5).map(i => ({
            title: i.title,
            url: i.url,
            score: i.score,
            source: i.source_name,
          })),
        } as HookCluster;
      } catch (e) {
        console.error("synth failed " + cl.cluster_name, e);
        return {
          pattern_name: cl.cluster_name,
          was_geht_viral: cl.items.slice(0, 3).map(i => i.title).join(" / "),
          warum_es_funktioniert: "",
          beispiele: cl.items.slice(0, 3).map(i => ({ title: i.title, url: i.url, score: i.score, source: i.source_name })),
          winkel_fuer_eigenen_post: "",
        } as HookCluster;
      }
    })
  );

  const topFormat = detectTopFormat(items);
  const summary = `${hookClusters.length} Hook-Muster aus ${items.length} Top-Posts in ${co.industry ?? co.name}`;

  const title = `Top-Post-Digest, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: dg, error: de } = await c.from("digests").insert({
    company_id: co.id,
    type: "top_post",
    title,
    cluster_analyses: hookClusters,
  }).select().single();
  if (de || !dg) throw new Error(`digest: ${de?.message}`);

  const di = clusters.flatMap(cl => {
    const hc = hookClusters.find(h => h.pattern_name === cl.cluster_name);
    return cl.items.map(item => ({
      digest_id: dg.id,
      cluster: cl.cluster_name,
      title: item.title,
      summary: hc?.was_geht_viral ?? "",
      source_url: item.url,
      source_name: item.source_name,
      source_tier: item.source_tier,
      published_at: item.published_at,
      raw_json: { ...item.raw, score: item.score },
    }));
  });

  if (di.length > 0) {
    const { error: ie } = await c.from("digest_items").insert(di);
    if (ie) throw new Error(ie.message);
  }

  return { digest_id: dg.id, clusters: hookClusters.length, items_total: di.length, top_format: topFormat };
}

async function clusterPosts(items: NewsItem[], co: Company) {
  const list = items.map((i, idx) => `[${idx}] ${i.score ? `(score:${i.score}) ` : ""}${i.title} (${i.source_name})`).join("\n");
  const r = await callClaudeJSON<{ clusters: { cluster_name: string; item_indices: number[] }[] }>({
    model: DEFAULT_MODEL,
    system: CLUSTER_PROMPT,
    messages: [{ role: "user", content: `Industrie: ${co.industry}\nKeywords: ${co.keywords.join(", ")}\n\nPosts:\n${list}` }],
    max_tokens: 2000,
  });
  return r.clusters.map(x => ({
    cluster_name: x.cluster_name,
    items: x.item_indices.map(i => items[i]).filter(Boolean),
  }));
}

async function synthCluster(items: NewsItem[], co: Company) {
  const list = items.map(i => `- ${i.score ? `[${i.score} pts] ` : ""}${i.title} | ${i.source_name} | ${i.url}`).join("\n");
  const system = SYNTH_PROMPT.replace("{company}", co.name ?? co.url ?? "").replace("{industry}", co.industry ?? "");
  return await callClaudeJSON<{ was_geht_viral: string; warum_es_funktioniert: string; winkel_fuer_eigenen_post: string }>({
    model: DEFAULT_MODEL,
    system,
    messages: [{ role: "user", content: list }],
    max_tokens: 1000,
    temperature: 0,
  });
}

function detectTopFormat(items: NewsItem[]): string {
  const sources = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.source_name] = (acc[i.source_name] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${s} (${n})`).join(", ");
}
