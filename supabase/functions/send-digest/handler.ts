// Bot: Email-Versand des Digests via Resend.
// Triggert: nach niche_news_cluster.
// Schreibt: digests.delivered_at.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job } from "../_shared/types.ts";

// TODO: RESEND_API_KEY in Supabase Vault setzen vor Tag 5.
// TODO: FROM_EMAIL in Env setzen, z.B. digest@deinedomain.com (verified in Resend).
const RESEND_API_URL = "https://api.resend.com/emails";

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("niche_news_send benötigt company_id.");
  // deno-lint-ignore no-explicit-any
  const digestId = job.payload.digest_id as string;
  if (!digestId) throw new Error("payload.digest_id fehlt.");

  // Digest plus Items laden.
  const { data: digest, error: digestErr } = await client
    .from("digests")
    .select("*")
    .eq("id", digestId)
    .single();

  if (digestErr || !digest) throw new Error(`Digest ${digestId} nicht gefunden.`);

  const { data: items, error: itemsErr } = await client
    .from("digest_items")
    .select("*")
    .eq("digest_id", digestId)
    .order("cluster");

  if (itemsErr) throw new Error(`digest_items query failed: ${itemsErr.message}`);

  // Company plus User-Email holen.
  const { data: company } = await client
    .from("companies")
    .select("*, user_id")
    .eq("id", job.company_id)
    .single();

  if (!company) throw new Error("Company nicht gefunden.");

  const { data: userResult } = await client.auth.admin.getUserById(company.user_id);
  const userEmail = userResult?.user?.email;
  if (!userEmail) throw new Error(`Keine Email für User ${company.user_id}.`);

  // Email rendern.
  const html = renderDigestHtml(digest.title, items ?? []);
  const subject = digest.title;

  // Resend-Call.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "digest@example.com";
  if (!apiKey) throw new Error("RESEND_API_KEY nicht gesetzt.");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `Niche Digest <${fromEmail}>`,
      to: [userEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();

  await client
    .from("digests")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", digestId);

  return { digest_id: digestId, recipient: userEmail, resend_id: data.id };
}

// deno-lint-ignore no-explicit-any
function renderDigestHtml(title: string, items: any[]): string {
  // Items nach Cluster gruppieren.
  // deno-lint-ignore no-explicit-any
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    const key = item.cluster ?? "Sonstiges";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const sections = Object.entries(grouped).map(([cluster, clusterItems]) => {
    const summary = clusterItems[0]?.summary ?? "";
    const itemsHtml = clusterItems
      .map(
        (item) =>
          `<li><a href="${escapeHtml(item.source_url)}" style="color:#0a66c2;">${escapeHtml(item.title)}</a> <span style="color:#666;font-size:13px;">— ${escapeHtml(item.source_name)}</span></li>`,
      )
      .join("");

    return `
      <section style="margin:24px 0;">
        <h2 style="font-size:18px;margin:0 0 8px;color:#111;">${escapeHtml(cluster)}</h2>
        <p style="font-size:15px;color:#333;margin:0 0 12px;">${escapeHtml(summary)}</p>
        <ul style="padding-left:20px;font-size:14px;color:#222;">${itemsHtml}</ul>
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111;">
    <h1 style="font-size:22px;margin:0 0 4px;">${escapeHtml(title)}</h1>
    <p style="font-size:13px;color:#666;margin:0 0 24px;">Niche-News-Digest. Berlin SaaS.</p>
    ${sections}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
    <p style="font-size:12px;color:#888;">Du bekommst diese Email weil du ein Berlin-SaaS-Setup angelegt hast.</p>
  </body>
</html>`;
}

function escapeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
