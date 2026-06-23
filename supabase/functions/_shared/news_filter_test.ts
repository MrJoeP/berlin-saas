import { assertEquals } from "./test_assert.ts";
import { filterItems } from "./news_filter.ts";
import { NewsItem, Source } from "./types.ts";

const NOW = new Date("2026-06-23T12:00:00.000Z").getTime();

function source(overrides: Partial<Source>): Source {
  return {
    id: "source-1",
    name: "Source",
    url: null,
    type: "rss",
    industry_tags: ["B2B SaaS"],
    config: {},
    is_default: true,
    tier: 2,
    min_score: 0,
    max_age_days: 7,
    ...overrides,
  };
}

function item(overrides: Partial<NewsItem>): NewsItem {
  return {
    title: "AI pricing update",
    url: "https://example.com/story",
    source_name: "Source",
    source_tier: 2,
    published_at: "2026-06-22T12:00:00.000Z",
    score: 0,
    raw: { description: "pricing" },
    ...overrides,
  };
}

Deno.test("filterItems applies reddit config through r/subreddit source_name alias", () => {
  const rows = [{
    sources: source({
      name: "r/SaaS",
      type: "reddit",
      config: { subreddit: "SaaS", min_score: 60 },
      tier: 3,
      min_score: 60,
    }),
  }];

  const filtered = filterItems(
    [
      item({ source_name: "r/SaaS", source_tier: 3, score: 10 }),
      item({
        source_name: "r/SaaS",
        source_tier: 3,
        score: 80,
        url: "https://example.com/pass",
      }),
    ],
    rows,
    [],
    NOW,
  );

  assertEquals(filtered.map((i) => i.url), ["https://example.com/pass"]);
});

Deno.test("filterItems filters tier-2 items by keyword tokens", () => {
  const rows = [{ sources: source({ name: "Editorial", tier: 2 }) }];

  const filtered = filterItems(
    [
      item({
        source_name: "Editorial",
        title: "AI pricing update",
        url: "https://example.com/pricing",
      }),
      item({
        source_name: "Editorial",
        title: "Generic funding news",
        url: "https://example.com/funding",
        raw: {},
      }),
    ],
    rows,
    ["pricing"],
    NOW,
  );

  assertEquals(filtered.map((i) => i.url), ["https://example.com/pricing"]);
});

Deno.test("filterItems deduplicates by normalized url and title", () => {
  const rows = [{ sources: source({ name: "Editorial", tier: 2 }) }];

  const filtered = filterItems(
    [
      item({
        source_name: "Editorial",
        title: "Same Story",
        url: "https://example.com/story?utm_source=x",
      }),
      item({
        source_name: "Editorial",
        title: "Same Story",
        url: "https://example.com/story",
      }),
    ],
    rows,
    [],
    NOW,
  );

  assertEquals(filtered.length, 1);
});

Deno.test("filterItems removes items matching negative keywords", () => {
  const rows = [{ sources: source({ name: "Editorial", tier: 2 }) }];

  const filtered = filterItems(
    [
      item({
        source_name: "Editorial",
        title: "AI pricing update",
        url: "https://example.com/pricing",
      }),
      item({
        source_name: "Editorial",
        title: "Crypto airdrop launch",
        url: "https://example.com/crypto",
      }),
    ],
    rows,
    ["pricing", "crypto"],
    NOW,
    ["crypto"],
  );

  assertEquals(filtered.map((i) => i.url), ["https://example.com/pricing"]);
});
