import { assertEquals } from "./test_assert.ts";
import {
  computeConfidence,
  computeSignalMetrics,
  countTrendStreak,
  prepareClusters,
} from "./digest_quality.ts";
import { DigestCluster, NewsItem } from "./types.ts";

function item(overrides: Partial<NewsItem>): NewsItem {
  return {
    title: "Default title",
    url: "https://example.com/default",
    source_name: "Example",
    source_tier: 2,
    published_at: "2026-06-22T00:00:00.000Z",
    score: 0,
    raw: {},
    ...overrides,
  };
}

Deno.test("computeConfidence prefers primary sources", () => {
  const result = computeConfidence([
    item({ source_tier: 1 }),
    item({ source_tier: 3, url: "https://example.com/community" }),
  ]);
  assertEquals(result.confidence, "verified");
  assertEquals(result.reason.includes("Primärquelle"), true);
});

Deno.test("computeConfidence marks two editorial sources as editorial", () => {
  const result = computeConfidence([
    item({ source_tier: 2, url: "https://example.com/a" }),
    item({ source_tier: 2, url: "https://example.com/b" }),
  ]);
  assertEquals(result.confidence, "editorial");
});

Deno.test("countTrendStreak counts consecutive weekly overlap", () => {
  const streak = countTrendStreak("AI Search Product Launches", [
    { cluster_name: "AI Search Launch Updates", weeks_ago: 1 },
    { cluster_name: "Product Launch AI Search", weeks_ago: 2 },
    { cluster_name: "Unrelated Pricing", weeks_ago: 3 },
  ]);
  assertEquals(streak, 3);
});

Deno.test("prepareClusters removes empty clusters and merges duplicate themes", () => {
  const clusters: DigestCluster[] = [
    {
      cluster_name: "AI Search Updates",
      items: [
        item({ title: "A", url: "https://example.com/a", source_tier: 1 }),
      ],
    },
    {
      cluster_name: "Search AI Update",
      items: [
        item({ title: "B", url: "https://example.com/b", source_tier: 2 }),
        item({ title: "", url: "", source_tier: 2 }),
      ],
    },
    { cluster_name: "Empty", items: [] },
  ];

  const prepared = prepareClusters(clusters);
  assertEquals(prepared.length, 1);
  assertEquals(prepared[0].items.length, 2);
});

Deno.test("computeSignalMetrics rewards relevant primary-source clusters", () => {
  const metrics = computeSignalMetrics(
    {
      cluster_name: "AI Search Pricing",
      items: [
        item({
          title: "AI search pricing changes",
          url: "https://example.com/a",
          source_tier: 1,
          score: 100,
        }),
        item({
          title: "Pricing analysis for AI tools",
          url: "https://example.com/b",
          source_tier: 2,
          score: 20,
        }),
      ],
    },
    { industry: "AI Tools", niche: "AI Search", keywords: ["pricing"] },
    1,
  );

  assertEquals(metrics.action_hint, "watch");
  assertEquals(metrics.priority_score >= 60, true);
  assertEquals(metrics.primary_source_count, 1);
});
