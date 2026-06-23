import { assertEquals } from "./test_assert.ts";
import { planNextJobs } from "./job_chain.ts";
import { Job } from "./types.ts";

function job(overrides: Partial<Job>): Job {
  return {
    id: "job-1",
    type: "scrape_company",
    company_id: "company-1",
    payload: {},
    status: "completed",
    result: null,
    error: null,
    retry_count: 0,
    max_retries: 3,
    scheduled_for: "2026-06-23T00:00:00.000Z",
    started_at: null,
    completed_at: null,
    depends_on: [],
    created_at: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

Deno.test("job chain plans scrape_company -> niche_news_scrape -> niche_news_cluster", () => {
  const afterCompany = planNextJobs(
    job({ id: "scrape-company", type: "scrape_company" }),
    { has_sources: true },
  );

  assertEquals(afterCompany, [{
    type: "niche_news_scrape",
    company_id: "company-1",
    payload: {},
    depends_on: ["scrape-company"],
  }]);

  const items = [{
    title: "Story",
    url: "https://example.com",
    source_name: "Source",
    source_tier: 2,
    published_at: null,
    score: null,
    raw: {},
  }];
  const afterScrape = planNextJobs(
    job({ id: "scrape-news", type: "niche_news_scrape" }),
    { items },
  );

  assertEquals(afterScrape, [{
    type: "niche_news_cluster",
    company_id: "company-1",
    payload: { items, scrape_job_id: "scrape-news" },
    depends_on: ["scrape-news"],
  }]);
});
