// Worker Edge Function.
// Wird via pg_cron jede Minute aufgerufen.
// Holt pending Jobs, dispatcht, markiert Status.
// Siehe ORCHESTRATOR.md für Detail-Architektur.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { dispatch } from "../_shared/dispatcher.ts";
import { Job } from "../_shared/types.ts";

const MAX_JOBS_PER_TICK = 5;
const BACKOFF_BASE_SECONDS = 60;

serve(async (_req) => {
  const client = getServiceClient();
  const processed: { id: string; status: string }[] = [];

  for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
    const job = await claimNextJob(client);
    if (!job) break;

    try {
      const result = await dispatch(job, client);
      await markCompleted(client, job.id, result);
      processed.push({ id: job.id, status: "completed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await handleFailure(client, job, message);
      processed.push({ id: job.id, status: "retry_or_failed" });
    }
  }

  return new Response(
    JSON.stringify({ processed, count: processed.length }),
    { headers: { "content-type": "application/json" } },
  );
});

// Claim einen Job atomar via PostgreSQL FOR UPDATE SKIP LOCKED.
// Voraussetzung: alle depends_on Jobs sind completed.
async function claimNextJob(client: ReturnType<typeof getServiceClient>): Promise<Job | null> {
  const { data, error } = await client.rpc("claim_next_job");
  if (error) {
    console.error("claim_next_job error:", error);
    return null;
  }
  if (!data || data.length === 0) return null;
  return data[0] as Job;
}

async function markCompleted(
  client: ReturnType<typeof getServiceClient>,
  jobId: string,
  result: Record<string, unknown>,
) {
  await client
    .from("jobs")
    .update({
      status: "completed",
      result,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function handleFailure(
  client: ReturnType<typeof getServiceClient>,
  job: Job,
  errorMessage: string,
) {
  const nextRetry = job.retry_count + 1;

  if (nextRetry >= job.max_retries) {
    await client
      .from("jobs")
      .update({
        status: "failed",
        error: errorMessage,
        retry_count: nextRetry,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  // Exponential backoff: 60s * 2^retry_count.
  const backoffSeconds = BACKOFF_BASE_SECONDS * Math.pow(2, nextRetry);
  const scheduledFor = new Date(Date.now() + backoffSeconds * 1000).toISOString();

  await client
    .from("jobs")
    .update({
      status: "pending",
      error: errorMessage,
      retry_count: nextRetry,
      scheduled_for: scheduledFor,
      started_at: null,
    })
    .eq("id", job.id);
}
