import { DigestCluster, NewsItem } from "./types.ts";

export type Confidence = "verified" | "editorial" | "community";

export interface ConfidenceResult {
  confidence: Confidence;
  reason: string;
}

export interface TrendMemoryEntry {
  cluster_name: string;
  weeks_ago: number;
}

export interface ClusterVoteSignal {
  target_id: string;
  score: number;
}

export interface CompanySignalContext {
  name?: string | null;
  industry?: string | null;
  niche?: string | null;
  product_description?: string | null;
  icp?: string | null;
  target_market?: string | null;
  keywords?: string[];
}

export interface ClusterSignalMetrics {
  priority_score: number;
  relevance_score: number;
  evidence_score: number;
  novelty_score: number;
  momentum_score: number;
  item_count: number;
  primary_source_count: number;
  editorial_source_count: number;
  community_source_count: number;
  action_hint: "act" | "watch" | "content" | "ignore";
  signal_reason: string;
}

export function computeConfidence(items: NewsItem[]): ConfidenceResult {
  const t1 = items.filter((i) => i.source_tier === 1).length;
  const t2 = items.filter((i) => i.source_tier === 2).length;
  const t3 = items.filter((i) => i.source_tier === 3).length;

  if (t1 >= 1) {
    return {
      confidence: "verified",
      reason: `${t1} Primärquelle${t1 === 1 ? "" : "n"} im Cluster`,
    };
  }
  if (t2 >= 2) {
    return {
      confidence: "editorial",
      reason: `${t2} redaktionelle Quellen im Cluster`,
    };
  }
  return {
    confidence: "community",
    reason: t3 > 0
      ? `nur Community- oder schwache Einzelsignale (${t3} Community-Item${
        t3 === 1 ? "" : "s"
      })`
      : "keine starken Quellen im Cluster",
  };
}

export function computeSignalMetrics(
  cluster: DigestCluster,
  context: CompanySignalContext,
  trendStreak = 1,
  voteSignals: ClusterVoteSignal[] = [],
): ClusterSignalMetrics {
  const items = cluster.items;
  const primary = items.filter((i) => i.source_tier === 1).length;
  const editorial = items.filter((i) => i.source_tier === 2).length;
  const community = items.filter((i) => i.source_tier === 3).length;
  const itemCount = items.length;

  const evidenceScore = clamp(
    primary * 35 + editorial * 18 + community * 8 + Math.min(itemCount, 8) * 3,
    0,
    100,
  );
  const relevanceScore = computeRelevanceScore(cluster, context);
  const noveltyScore = trendStreak <= 1
    ? 85
    : trendStreak === 2
    ? 65
    : trendStreak === 3
    ? 45
    : 30;
  const momentumScore = clamp(
    Math.min(itemCount, 10) * 7 +
      Math.min(maxItemScore(items) / 5, 30) +
      (trendStreak >= 2 ? 15 : 0) +
      voteScore(cluster, voteSignals) * 10,
    0,
    100,
  );
  const priorityScore = Math.round(
    relevanceScore * 0.34 +
      evidenceScore * 0.28 +
      momentumScore * 0.23 +
      noveltyScore * 0.15,
  );
  const actionHint = chooseActionHint(
    priorityScore,
    evidenceScore,
    relevanceScore,
    community,
  );

  return {
    priority_score: priorityScore,
    relevance_score: Math.round(relevanceScore),
    evidence_score: Math.round(evidenceScore),
    novelty_score: Math.round(noveltyScore),
    momentum_score: Math.round(momentumScore),
    item_count: itemCount,
    primary_source_count: primary,
    editorial_source_count: editorial,
    community_source_count: community,
    action_hint: actionHint,
    signal_reason: buildSignalReason(
      priorityScore,
      relevanceScore,
      evidenceScore,
      momentumScore,
      trendStreak,
    ),
  };
}

export function countTrendStreak(
  currentName: string,
  memory: TrendMemoryEntry[],
): number {
  const currentTokens = tokenize(currentName);
  let streak = 1;
  for (let week = 1; week <= 4; week++) {
    const match = memory.find((m) => {
      if (m.weeks_ago !== week) return false;
      const overlap = currentTokens.filter((t) =>
        tokenize(m.cluster_name).includes(t)
      ).length;
      return overlap >= 2;
    });
    if (match) streak++;
    else break;
  }
  return streak;
}

export function prepareClusters(
  clusters: DigestCluster[],
  voteSignals: ClusterVoteSignal[] = [],
): DigestCluster[] {
  const byName = new Map<string, DigestCluster>();

  for (const cluster of clusters) {
    const cleanItems = dedupeItems(
      cluster.items.filter((item) => item?.title && item?.url),
    );
    if (cleanItems.length === 0) continue;

    const key = normalizeClusterName(cluster.cluster_name);
    if (!key) continue;

    const existing = byName.get(key);
    if (existing) {
      existing.items = dedupeItems([...existing.items, ...cleanItems]);
      if (cluster.cluster_name.length < existing.cluster_name.length) {
        existing.cluster_name = cluster.cluster_name;
      }
    } else {
      byName.set(key, {
        cluster_name: cluster.cluster_name.trim(),
        items: cleanItems,
      });
    }
  }

  return [...byName.values()].sort((a, b) =>
    clusterScore(b, voteSignals) - clusterScore(a, voteSignals)
  );
}

export function normalizeClusterName(name: string): string {
  return tokenize(name)
    .filter((token) => !CLUSTER_STOPWORDS.has(token))
    .sort()
    .join(" ");
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-,.&/():;!?]+/)
    .map((t) => t.trim())
    .map(stemToken)
    .filter((t) => t.length > 3);
}

function stemToken(token: string): string {
  if (/(ches|shes|xes|zes|ses)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function dedupeItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  for (const item of items) {
    const key = `${normalizeUrl(item.url)}|${item.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_term");
    u.searchParams.delete("utm_content");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function clusterScore(
  cluster: DigestCluster,
  voteSignals: ClusterVoteSignal[],
): number {
  const confidence = computeConfidence(cluster.items).confidence;
  const confidenceScore = confidence === "verified"
    ? 300
    : confidence === "editorial"
    ? 200
    : 100;
  const tierScore = cluster.items.reduce(
    (sum, item) => sum + (4 - (item.source_tier ?? 3)),
    0,
  );
  const sourceScore = cluster.items.reduce(
    (sum, item) => sum + Math.max(item.score ?? 0, 0) / 100,
    0,
  );
  const voteScore = voteSignals
    .filter((signal) => signal.target_id.endsWith(`|${cluster.cluster_name}`))
    .reduce((sum, signal) => sum + signal.score * 25, 0);
  return confidenceScore + tierScore + sourceScore + voteScore +
    cluster.items.length;
}

function computeRelevanceScore(
  cluster: DigestCluster,
  context: CompanySignalContext,
): number {
  const contextTerms = [
    context.name ?? "",
    context.industry ?? "",
    context.niche ?? "",
    context.product_description ?? "",
    context.icp ?? "",
    context.target_market ?? "",
    ...(context.keywords ?? []),
  ]
    .flatMap(tokenize)
    .filter((token) => !RELEVANCE_STOPWORDS.has(token));

  if (contextTerms.length === 0) return 45;

  const text = [
    cluster.cluster_name,
    ...cluster.items.map((item) =>
      `${item.title} ${String(item.raw.description ?? "")}`
    ),
  ].join(" ").toLowerCase();

  const matches = new Set(contextTerms.filter((term) => text.includes(term)));
  return clamp(
    35 + matches.size * 13 + Math.min(cluster.items.length, 6) * 3,
    0,
    100,
  );
}

function maxItemScore(items: NewsItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.score ?? 0), 0);
}

function voteScore(
  cluster: DigestCluster,
  voteSignals: ClusterVoteSignal[],
): number {
  return voteSignals
    .filter((signal) => signal.target_id.endsWith(`|${cluster.cluster_name}`))
    .reduce((sum, signal) => sum + signal.score, 0);
}

function chooseActionHint(
  priorityScore: number,
  evidenceScore: number,
  relevanceScore: number,
  communityCount: number,
): ClusterSignalMetrics["action_hint"] {
  if (priorityScore >= 75 && evidenceScore >= 55 && relevanceScore >= 60) {
    return "act";
  }
  if (priorityScore >= 60 && communityCount >= 2) return "content";
  if (priorityScore >= 45) return "watch";
  return "ignore";
}

function buildSignalReason(
  priority: number,
  relevance: number,
  evidence: number,
  momentum: number,
  trendStreak: number,
): string {
  const parts = [
    `Priorität ${Math.round(priority)}/100`,
    `Relevanz ${Math.round(relevance)}/100`,
    `Evidenz ${Math.round(evidence)}/100`,
    `Momentum ${Math.round(momentum)}/100`,
  ];
  if (trendStreak >= 2) parts.push(`${trendStreak}. Woche in Folge`);
  return parts.join(" · ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const CLUSTER_STOPWORDS = new Set([
  "news",
  "update",
  "updates",
  "trend",
  "trends",
  "discussion",
  "launch",
  "launches",
  "market",
  "industry",
  "community",
]);

const RELEVANCE_STOPWORDS = new Set([
  ...CLUSTER_STOPWORDS,
  "gmbh",
  "labs",
  "inc",
  "company",
  "software",
  "platform",
  "tools",
  "tool",
]);
