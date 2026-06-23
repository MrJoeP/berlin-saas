import { Job, JobType } from "./types.ts";

export interface PlannedJob {
  type: JobType;
  company_id: string;
  payload: Record<string, unknown>;
  depends_on: string[];
}

export function planNextJobs(
  job: Job,
  result: Record<string, unknown>,
): PlannedJob[] {
  if (!job.company_id) return [];

  if (job.type === "scrape_company" && result.has_sources === true) {
    return [{
      type: "niche_news_scrape",
      company_id: job.company_id,
      payload: {},
      depends_on: [job.id],
    }];
  }

  if (job.type === "niche_news_scrape" && Array.isArray(result.items)) {
    return [{
      type: "niche_news_cluster",
      company_id: job.company_id,
      payload: { items: result.items, scrape_job_id: job.id },
      depends_on: [job.id],
    }];
  }

  return [];
}
