// Dispatcher mappt Job-Type auf Handler-Function.
// Static imports, damit Supabase die Handler im Worker-Bundle inkludiert.
// Neuer Bot = neuer Import plus neuer Eintrag im handlers-Map.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, JobType } from "./types.ts";

import { handle as scrapeCompany } from "../scrape-company/handler.ts";
import { handle as scrapeNews } from "../scrape-news/handler.ts";
import { handle as generateDigest } from "../generate-digest/handler.ts";
import { handle as topPostScrape } from "../tool-02-top-posts/top-post-scrape.ts";
import { handle as topPostCluster } from "../tool-02-top-posts/top-post-cluster.ts";
import { handle as radarSnapshot } from "../tool-03-market-radar/radar-snapshot.ts";
import { handle as radarSignals } from "../tool-03-market-radar/radar-signals.ts";
import { handle as radarDigest } from "../tool-03-market-radar/radar-digest.ts";

export type JobHandler = (
  job: Job,
  client: SupabaseClient,
) => Promise<Record<string, unknown>>;

const handlers: Record<JobType, JobHandler> = {
  scrape_company: scrapeCompany,
  niche_news_scrape: scrapeNews,
  niche_news_cluster: generateDigest,
  top_post_scrape: topPostScrape,
  top_post_cluster: topPostCluster,
  radar_snapshot: radarSnapshot,
  radar_signals: radarSignals,
  radar_digest: radarDigest,
};

export async function dispatch(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`Unknown job type: ${job.type}`);
  return await handler(job, client);
}
