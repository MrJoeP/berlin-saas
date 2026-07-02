// Relevanz-Algorithmus: lernt aus Item-Votes, welche Quellen und Themen
// eine Company interessieren. Wird von BEIDEN Tools genutzt (niche_news + top_post),
// jeweils getrennt pro digest_type — eine Quelle kann im News-Digest stark und
// im Published-Content schwach sein.
//
// Drei Signale:
//   1. Source-Weights: Netto-Votes pro Quelle (mit Zeit-Decay) → Boost/Demote im Ranking.
//   2. Interest-Tokens: Wörter aus Titeln upgevoteter Items → Item-Boost + Cluster-Prompt-Hinweis.
//   3. Negative-Tokens: Wörter aus Titeln runtergevoteter Items → Item-Demote (kein Hard-Filter).
//
// Formeln bewusst deterministisch (kein LLM) und hier zentral, damit sie testbar sind.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { NewsItem } from "./types.ts";
import { tokenize } from "./digest_quality.ts";

// Half-Life ~8 Wochen: ein Vote von heute zählt voll, einer von vor 8 Wochen ~50%.
const DECAY_DAYS = 56 / Math.LN2;
// Cold-Start-Guard: Gewicht greift erst ab so vielen Votes auf einer Quelle.
const MIN_VOTES_PER_SOURCE = 3;
export const MUTED_WEIGHT_THRESHOLD = 0.6;
// Quellen unter dem Muted-Threshold liefern höchstens so viele Items.
export const MUTED_SOURCE_CAP = 3;

export interface VoteSignalRow {
  source_name: string | null;
  title: string | null;
  value: number;
  created_at: string;
}

export interface RelevanceProfile {
  sourceWeights: Record<string, number>;
  interestTokens: string[];
  negativeTokens: string[];
  voteCount: number;
}

export const NEUTRAL_PROFILE: RelevanceProfile = {
  sourceWeights: {},
  interestTokens: [],
  negativeTokens: [],
  voteCount: 0,
};

export function decayFactor(createdAt: string, now: number): number {
  const ageDays = Math.max(0, (now - new Date(createdAt).getTime()) / 86_400_000);
  return Math.exp(-ageDays / DECAY_DAYS);
}

// weight = 1 + decayed_net / 5, geklemmt auf [0.5, 2.0].
// 5 frische Netto-Upvotes → 2.0 (doppelte Priorität); 3 frische Downvotes → ~0.5.
export function computeSourceWeights(
  rows: VoteSignalRow[],
  now = Date.now(),
): Record<string, number> {
  const bySource = new Map<string, { net: number; count: number }>();
  for (const row of rows) {
    if (!row.source_name) continue;
    const entry = bySource.get(row.source_name) ?? { net: 0, count: 0 };
    entry.net += row.value * decayFactor(row.created_at, now);
    entry.count += 1;
    bySource.set(row.source_name, entry);
  }
  const weights: Record<string, number> = {};
  for (const [source, { net, count }] of bySource) {
    if (count < MIN_VOTES_PER_SOURCE) continue;
    weights[source] = Math.min(2.0, Math.max(0.5, 1 + net / 5));
  }
  return weights;
}

// Interest-/Negative-Tokens aus Vote-Titeln. Ein Token zählt erst ab
// decayed weight >= 1.5 (also mind. 2 halbwegs frische Votes) — ein einzelner
// Klick prägt kein Thema. Tokens, die in beiden Listen landen würden,
// gewinnen über das Vorzeichen der Netto-Summe.
export function computeTopicTokens(
  rows: VoteSignalRow[],
  now = Date.now(),
): { interest: string[]; negative: string[] } {
  const tokenNet = new Map<string, number>();
  for (const row of rows) {
    if (!row.title) continue;
    const factor = row.value * decayFactor(row.created_at, now);
    for (const token of new Set(tokenize(row.title))) {
      tokenNet.set(token, (tokenNet.get(token) ?? 0) + factor);
    }
  }
  const entries = [...tokenNet.entries()];
  const interest = entries
    .filter(([, net]) => net >= 1.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token]) => token);
  const negative = entries
    .filter(([, net]) => net <= -1.5)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 20)
    .map(([token]) => token);
  return { interest, negative };
}

// Item-Boost aus Topic-Match: Interest +60 pro Treffer (max +120),
// Negative -80 pro Treffer (max -160). Demote statt Hard-Filter —
// explizite negative_keywords der Company filtern weiterhin hart.
export function topicBoost(item: NewsItem, profile: RelevanceProfile): number {
  if (
    profile.interestTokens.length === 0 && profile.negativeTokens.length === 0
  ) return 0;
  const haystackTokens = new Set(
    tokenize(`${item.title} ${String(item.raw?.description ?? "")}`),
  );
  let boost = 0;
  let interestHits = 0;
  let negativeHits = 0;
  for (const token of profile.interestTokens) {
    if (haystackTokens.has(token) && interestHits < 2) {
      boost += 60;
      interestHits++;
    }
  }
  for (const token of profile.negativeTokens) {
    if (haystackTokens.has(token) && negativeHits < 2) {
      boost -= 80;
      negativeHits++;
    }
  }
  return boost;
}

export function sourceWeightFor(
  item: NewsItem,
  profile: RelevanceProfile,
): number {
  return profile.sourceWeights[item.source_name] ?? 1;
}

// Kombinierter Rang eines Items unter Berücksichtigung des gelernten Profils.
// base: Tier-Vertrauen (T1=300, T2=200, T3=100) skaliert mit Source-Weight,
// plus Engagement-Score (gedeckelt) und Topic-Boost.
export function relevanceRank(
  item: NewsItem,
  profile: RelevanceProfile,
): number {
  const tier = item.source_tier ?? 3;
  const base = (4 - tier) * 100;
  const engagement = Math.min(item.score ?? 0, 200) * 0.2;
  return base * sourceWeightFor(item, profile) + engagement +
    topicBoost(item, profile);
}

// Muted-Quellen (weight < Threshold) auf wenige Items kappen statt komplett
// zu entfernen — so kann sich eine Quelle durch neue Upvotes rehabilitieren.
export function capMutedSources(
  items: NewsItem[],
  profile: RelevanceProfile,
): NewsItem[] {
  const perSource = new Map<string, number>();
  const result: NewsItem[] = [];
  for (const item of items) {
    const weight = sourceWeightFor(item, profile);
    if (weight < MUTED_WEIGHT_THRESHOLD) {
      const used = perSource.get(item.source_name) ?? 0;
      if (used >= MUTED_SOURCE_CAP) continue;
      perSource.set(item.source_name, used + 1);
    }
    result.push(item);
  }
  return result;
}

// Lädt das gelernte Profil einer Company für ein Tool aus der Vote-Signal-View.
// Fail-open: bei Fehlern (View fehlt, Netz) kommt das neutrale Profil zurück —
// der Digest läuft dann einfach ohne Personalisierung.
export async function loadRelevanceProfile(
  client: SupabaseClient,
  companyId: string,
  digestType: string,
): Promise<RelevanceProfile> {
  try {
    const { data, error } = await client
      .from("vote_item_signals")
      .select("source_name, title, value, created_at")
      .eq("company_id", companyId)
      .eq("digest_type", digestType)
      .gte(
        "created_at",
        new Date(Date.now() - 180 * 86_400_000).toISOString(),
      );
    if (error || !data) return NEUTRAL_PROFILE;
    const rows = data as VoteSignalRow[];
    const { interest, negative } = computeTopicTokens(rows);
    return {
      sourceWeights: computeSourceWeights(rows),
      interestTokens: interest,
      negativeTokens: negative,
      voteCount: rows.length,
    };
  } catch (err) {
    console.warn("loadRelevanceProfile failed, using neutral profile:", err);
    return NEUTRAL_PROFILE;
  }
}

// Cluster-Vote-Signale (decayed, company- und tool-scoped) im Format,
// das digest_quality.prepareClusters erwartet (target_id endet auf |cluster_name).
export async function loadClusterVoteSignals(
  client: SupabaseClient,
  companyId: string,
  digestType: string,
): Promise<{ target_id: string; score: number }[]> {
  try {
    const { data, error } = await client
      .from("vote_cluster_signals")
      .select("cluster_name, value, created_at")
      .eq("company_id", companyId)
      .eq("digest_type", digestType);
    if (error || !data) return [];
    const now = Date.now();
    const scores = new Map<string, number>();
    for (
      const row of data as {
        cluster_name: string;
        value: number;
        created_at: string;
      }[]
    ) {
      scores.set(
        row.cluster_name,
        (scores.get(row.cluster_name) ?? 0) +
          row.value * decayFactor(row.created_at, now),
      );
    }
    return [...scores.entries()].map(([name, score]) => ({
      target_id: `|${name}`,
      score,
    }));
  } catch {
    return [];
  }
}

// Prompt-Hinweis für Cluster-/Synthese-Prompts beider Tools.
export function interestPromptNote(profile: RelevanceProfile): string {
  if (profile.interestTokens.length === 0) return "";
  const top = profile.interestTokens.slice(0, 8).join(", ");
  return `\nAus Nutzer-Votes gelernte Schwerpunkte (bevorzugt clustern/gewichten): ${top}`;
}
