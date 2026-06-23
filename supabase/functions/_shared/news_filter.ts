import { NewsItem, Source } from "./types.ts";

export interface CompanySourceWithSource {
  sources: Source | null;
}

export function filterItems(
  items: NewsItem[],
  companySources: CompanySourceWithSource[],
  keywords: string[],
  now = Date.now(),
  negativeKeywords: string[] = [],
): NewsItem[] {
  const sourceConfig: Record<
    string,
    { min_score: number; max_age_days: number; tier: number }
  > = {};
  for (const row of companySources) {
    const source = row.sources;
    if (!source) continue;
    const config = source.config ?? {};
    const minScore = numberFromConfig(config.min_score, source.min_score ?? 0);
    const maxAgeDays = numberFromConfig(
      config.max_age_days,
      source.max_age_days ?? 7,
    );
    const tier = numberFromConfig(config.tier, source.tier ?? 3);
    const cfg = { min_score: minScore, max_age_days: maxAgeDays, tier };

    for (const key of sourceKeys(source)) {
      sourceConfig[key] = cfg;
    }
  }

  const seen = new Set<string>();
  const keywordTokens = tokenizeKeywords(keywords);
  const negativeTokens = tokenizeKeywords(negativeKeywords);
  const passed: NewsItem[] = [];

  for (const item of items) {
    const cfg = sourceConfig[item.source_name] ??
      { min_score: 0, max_age_days: 7, tier: item.source_tier ?? 3 };

    if (cfg.min_score > 0 && (item.score ?? 0) < cfg.min_score) continue;

    if (item.published_at) {
      const ageMs = now - new Date(item.published_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > cfg.max_age_days) continue;
    }

    const dedupKey = normalize(item.url) + "|" +
      normalize(item.title).slice(0, 80);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const haystack = (item.title + " " + (item.raw.description ?? ""))
      .toLowerCase();
    if (negativeTokens.some((kw) => haystack.includes(kw))) continue;

    if (keywordTokens.length > 0 && cfg.tier === 2) {
      const matches = keywordTokens.some((kw) => haystack.includes(kw));
      if (!matches) continue;
    }

    passed.push(item);
  }

  passed.sort((a, b) => {
    if (a.source_tier !== b.source_tier) return a.source_tier - b.source_tier;
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime();
  });

  return passed;
}

export function tokenizeKeywords(keywords: string[]): string[] {
  return keywords
    .flatMap((k) => k.toLowerCase().split(/[\s\-,.&/]+/))
    .filter((t) => t.length >= 3 && !KEYWORD_STOPWORDS.has(t));
}

function sourceKeys(source: Source): string[] {
  const keys = new Set([source.name]);
  const config = source.config ?? {};
  if (source.type === "reddit" && typeof config.subreddit === "string") {
    keys.add(`r/${config.subreddit}`);
  }
  if (source.type === "hackernews") keys.add("Hacker News");
  if (source.type === "producthunt") keys.add("Product Hunt");
  return [...keys];
}

function normalize(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase().slice(0, 200);
  } catch {
    return input.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 200);
  }
}

function numberFromConfig(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const KEYWORD_STOPWORDS = new Set([
  "und",
  "der",
  "die",
  "das",
  "für",
  "fur",
  "mit",
  "von",
  "the",
  "and",
  "for",
  "with",
  "ein",
  "eine",
]);
