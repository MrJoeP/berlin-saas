import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, NewsItem, Company } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";

interface HookCluster {
  pattern_name: string;
  format_typ: string;
  plattform_mix: string[];
  was_geht_viral: string;
  hook_einstieg: string;
  warum_es_funktioniert: string;
  zielgruppe_reaktion: string;
  plattform_staerke: string;
  winkel_fuer_eigenen_post: string;
  beispiele: { title: string; url: string; score: number | null; source: string }[];
}

const CLUSTER_PROMPT = `Du analysierst Top-Posts der letzten Woche und erkennst Hook-Muster.
Clustere die Posts nach ihrem dominanten Hook-Muster. 4-8 Cluster.
Antworte nur JSON:
{"clusters":[{"pattern_name":"...","format_typ":"list|story|contrarian|data|how-to|opinion|case-study|news","item_indices":[0,2,5]}]}`;

const SYNTH_PROMPT = `Du bist Content-Stratege und analysierst warum Posts der letzten Woche viral gegangen sind.

Firma: {company}
Industrie: {industry}
Nische: {niche}
Produkt: {product}
ICP: {icp}

Antworte JSON:
{
  "was_geht_viral": "2-3 Sätze was diese Posts gemeinsam haben",
  "hook_einstieg": "Wie die Posts beginnen — konkrete Formulierungsbeispiele",
  "warum_es_funktioniert": "Psychologische Erklärung, kurz und präzise",
  "zielgruppe_reaktion": "Wer reagiert darauf und warum",
  "plattform_staerke": "Auf welcher Plattform funktioniert das am besten und warum",
  "winkel_fuer_eigenen_post": "Konkrete Empfehlung: Wie kann {company} dieses Muster nutzen? Spezifisch auf Produkt und ICP bezogen."
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
      const beispiele = cl.items.slice(0, 6).map(i => ({
        title: i.title,
        url: i.url,
        score: i.score,
        source: i.source_name,
      }));
      const plattform_mix = [...new Set(cl.items.map(i => i.source_name))];

      try {
        const synth = await synthCluster(cl.items, co as Company);
        return {
          pattern_name: cl.cluster_name,
          format_typ: cl.format_typ ?? "news",
          plattform_mix,
          ...synth,
          beispiele,
        } as HookCluster;
      } catch (e) {
        console.error("synth failed " + cl.cluster_name, e);
        return {
          pattern_name: cl.cluster_name,
          format_typ: cl.format_typ ?? "news",
          plattform_mix,
          was_geht_viral: cl.items.slice(0, 3).map(i => i.title).join(" / "),
          hook_einstieg: "",
          warum_es_funktioniert: "",
          zielgruppe_reaktion: "",
          plattform_staerke: "",
          winkel_fuer_eigenen_post: "",
          beispiele,
        } as HookCluster;
      }
    })
  );

  const title = `Top-Post-Digest, ${new Date().toLocaleDateString("de-DE")}`;
  const { data: dg, error: de } = await c.from("digests").insert({
    company_id: co.id,
    type: "top_post",
    title,
    cluster_analyses: hookClusters,
  }).select().single();
  if (de || !dg) throw new Error(`digest: ${de?.message}`);

  const di = hookClusters.flatMap(hc => {
    const cl = clusters.find(x => x.cluster_name === hc.pattern_name);
    return (cl?.items ?? []).map(item => ({
      digest_id: dg.id,
      cluster: hc.pattern_name,
      title: item.title,
      summary: hc.was_geht_viral,
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

  return { digest_id: dg.id, clusters: hookClusters.length, items_total: di.length };
}

async function clusterPosts(items: NewsItem[], co: Company) {
  const list = items
    .map((i, idx) => `[${idx}] ${i.score ? `▲${i.score} ` : ""}${i.title} (${i.source_name})`)
    .join("\n");
  const r = await callClaudeJSON<{ clusters: { pattern_name: string; format_typ: string; item_indices: number[] }[] }>({
    model: DEFAULT_MODEL,
    system: CLUSTER_PROMPT,
    messages: [{
      role: "user",
      content: `Industrie: ${co.industry ?? ""}\nNische: ${(co as any).niche ?? ""}\nKeywords: ${(co.keywords ?? []).join(", ")}\n\nPosts:\n${list}`,
    }],
    max_tokens: 2000,
  });
  return r.clusters.map(x => ({
    cluster_name: x.pattern_name,
    format_typ: x.format_typ,
    items: x.item_indices.map(i => items[i]).filter(Boolean),
  }));
}

async function synthCluster(items: NewsItem[], co: Company) {
  const list = items.map(i => `- ${i.score ? `[▲${i.score}] ` : ""}${i.title} | ${i.source_name}`).join("\n");
  const system = SYNTH_PROMPT
    .replace(/{company}/g, co.name ?? co.url ?? "")
    .replace("{industry}", co.industry ?? "")
    .replace("{niche}", (co as any).niche ?? "")
    .replace("{product}", (co as any).product_description ?? "")
    .replace("{icp}", (co as any).icp ?? "");
  return await callClaudeJSON<{
    was_geht_viral: string;
    hook_einstieg: string;
    warum_es_funktioniert: string;
    zielgruppe_reaktion: string;
    plattform_staerke: string;
    winkel_fuer_eigenen_post: string;
  }>({
    model: DEFAULT_MODEL,
    system,
    messages: [{ role: "user", content: list }],
    max_tokens: 1200,
    temperature: 0,
  });
}
