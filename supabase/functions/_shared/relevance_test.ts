import { assertEquals } from "./test_assert.ts";
import {
  capMutedSources,
  computeSourceWeights,
  computeTopicTokens,
  NEUTRAL_PROFILE,
  relevanceRank,
  topicBoost,
  type VoteSignalRow,
} from "./relevance.ts";
import { NewsItem } from "./types.ts";

const NOW = new Date("2026-06-23T12:00:00.000Z").getTime();

function vote(overrides: Partial<VoteSignalRow>): VoteSignalRow {
  return {
    source_name: "Search Engine Journal",
    title: "Google AI Overviews ranking shift",
    value: 1,
    created_at: "2026-06-22T12:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<NewsItem>): NewsItem {
  return {
    title: "Some headline",
    url: "https://example.com/a",
    source_name: "Search Engine Journal",
    source_tier: 2,
    published_at: "2026-06-22T12:00:00.000Z",
    score: 0,
    raw: {},
    ...overrides,
  };
}

Deno.test("source weight needs at least 3 votes (cold start guard)", () => {
  const rows = [vote({}), vote({})];
  assertEquals(computeSourceWeights(rows, NOW), {});
});

Deno.test("fresh upvotes boost, downvotes demote, clamped", () => {
  const up = Array.from({ length: 10 }, () => vote({}));
  const down = Array.from(
    { length: 10 },
    () => vote({ source_name: "Noisy Blog", value: -1 }),
  );
  const weights = computeSourceWeights([...up, ...down], NOW);
  assertEquals(weights["Search Engine Journal"], 2.0); // clamp oben
  assertEquals(weights["Noisy Blog"], 0.5); // clamp unten
});

Deno.test("old votes decay: 16 weeks old counts ~25%", () => {
  const old = Array.from(
    { length: 4 },
    () => vote({ created_at: "2026-03-02T12:00:00.000Z" }), // ~16 Wochen vor NOW
  );
  const weights = computeSourceWeights(old, NOW);
  // 4 Votes * ~0.25 decay = ~1.0 net → weight ~1.2, sicher unter 1.3
  const w = weights["Search Engine Journal"];
  if (w === undefined || w <= 1.05 || w >= 1.3) {
    throw new Error(`expected decayed weight ~1.2, got ${w}`);
  }
});

Deno.test("topic tokens need net >= 1.5 and split by sign", () => {
  const rows = [
    vote({ title: "AI Overviews update rollout" }),
    vote({ title: "AI Overviews klickrate analyse" }),
    vote({ title: "Crypto scam headline", value: -1 }),
    vote({ title: "Crypto pump story", value: -1 }),
  ];
  const { interest, negative } = computeTopicTokens(rows, NOW);
  assertEquals(interest.includes("overview"), true); // gestemmt: overviews→overview
  assertEquals(negative.includes("crypto"), true);
  assertEquals(interest.includes("crypto"), false);
});

Deno.test("topicBoost rewards interest and punishes negative, capped", () => {
  const profile = {
    ...NEUTRAL_PROFILE,
    interestTokens: ["overview", "ranking"],
    negativeTokens: ["crypto"],
  };
  const good = item({ title: "AI Overviews ranking analysis" });
  const bad = item({ title: "Crypto news roundup" });
  assertEquals(topicBoost(good, profile), 120); // 2 Treffer à 60, Cap greift
  assertEquals(topicBoost(bad, profile), -80);
});

Deno.test("relevanceRank: weighted T2 source can beat neutral T1", () => {
  const profile = {
    ...NEUTRAL_PROFILE,
    sourceWeights: { "Search Engine Journal": 2.0 },
  };
  const lovedT2 = item({ source_tier: 2 }); // 200 * 2.0 = 400
  const neutralT1 = item({ source_name: "OpenAI Blog", source_tier: 1 }); // 300
  const rankT2 = relevanceRank(lovedT2, profile);
  const rankT1 = relevanceRank(neutralT1, profile);
  if (rankT2 <= rankT1) {
    throw new Error(`expected ${rankT2} > ${rankT1}`);
  }
});

Deno.test("capMutedSources keeps max 3 items from muted source", () => {
  const profile = {
    ...NEUTRAL_PROFILE,
    sourceWeights: { "Noisy Blog": 0.5 },
  };
  const items = [
    ...Array.from(
      { length: 5 },
      (_, i) =>
        item({
          source_name: "Noisy Blog",
          url: `https://noisy.example/${i}`,
        }),
    ),
    item({ url: "https://sej.example/keep" }),
  ];
  const result = capMutedSources(items, profile);
  assertEquals(
    result.filter((i) => i.source_name === "Noisy Blog").length,
    3,
  );
  assertEquals(result.length, 4);
});

Deno.test("neutral profile changes nothing", () => {
  const items = [
    item({ source_tier: 1, source_name: "OpenAI Blog" }),
    item({ source_tier: 3, source_name: "YouTube · Moz" }),
  ];
  assertEquals(capMutedSources(items, NEUTRAL_PROFILE).length, 2);
  assertEquals(topicBoost(items[0], NEUTRAL_PROFILE), 0);
});
