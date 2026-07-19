// radar_digest: bewertet neue Signale, dedupt, gruppiert nach Linse und baut
// den Radar-Digest (digests.type='competitor'). Schwelle 45, Cap 3 pro Entität,
// Drift-Eskalation nach 2 Wochen Streak. Signale unter der Schwelle werden als
// 'dropped' gespeichert (Kalibrierdaten), nie angezeigt.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job } from "../_shared/types.ts";

const SCORE_THRESHOLD = 45;
const MAX_PER_ENTITY = 3;

interface SignalRow {
  id: string;
  entity_id: string;
  signal_type: "page_diff" | "mention" | "news" | "baseline";
  title: string;
  body: string;
  why_it_matters: string;
  next_step: string;
  source_url: string | null;
  source_name: string | null;
  lens: "competitor" | "substitute" | "complement";
  tags: string[];
  payload: Record<string, unknown>;
  severity: number;
  drift_score: number;
  detected_at: string;
}

interface EntityRow {
  id: string;
  name: string;
  drift_streak: number;
}

export interface RadarDigestSignal {
  signal_id: string;
  entity_name: string;
  signal_type: string;
  title: string;
  what_happened: string;
  why_it_matters: string;
  next_step: string;
  source_url: string | null;
  source_name: string | null;
  detected_at: string;
  severity: number;
  score: number;
  drift_flag: boolean;
  pinned: boolean;
  diff: { removed: string[]; added: string[] } | null;
}

export interface RadarDigestCluster {
  lens: "competitor" | "substitute" | "complement";
  signals: RadarDigestSignal[];
}

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");

  const { data: signalRows } = await c
    .from("entity_signals")
    .select("*")
    .eq("company_id", job.company_id)
    .eq("status", "new");
  const signals = (signalRows ?? []) as SignalRow[];

  const { data: entityRows } = await c
    .from("entities")
    .select("id, name, drift_streak")
    .eq("company_id", job.company_id);
  const entityById = new Map(((entityRows ?? []) as EntityRow[]).map((e) => [e.id, e]));

  // Dedup innerhalb des Laufs: gleiche URL nur einmal.
  const seen = new Set<string>();
  const deduped = signals.filter((s) => {
    const key = (s.source_url ?? s.id).replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score + Drift-Eskalation.
  const scored = deduped.map((s) => {
    const entity = entityById.get(s.entity_id);
    const pinned = (entity?.drift_streak ?? 0) >= 2 && s.drift_score >= 60;
    const severity = pinned ? 5 : s.severity;
    return { signal: s, severity, pinned, score: computeScore(s, severity) };
  });

  const passing = scored.filter((x) => x.score >= SCORE_THRESHOLD);
  const dropped = scored.filter((x) => x.score < SCORE_THRESHOLD);

  // Cap pro Entität, sonst dominiert ein lauter Akteur den Digest.
  const byEntityCount = new Map<string, number>();
  const kept: typeof passing = [];
  for (const x of [...passing].sort((a, b) => b.score - a.score)) {
    const n = byEntityCount.get(x.signal.entity_id) ?? 0;
    if (n >= MAX_PER_ENTITY) {
      dropped.push(x);
      continue;
    }
    byEntityCount.set(x.signal.entity_id, n + 1);
    kept.push(x);
  }

  const clusters: RadarDigestCluster[] = (["competitor", "substitute", "complement"] as const)
    .map((lens) => ({
      lens,
      signals: kept
        .filter((x) => x.signal.lens === lens)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.score - a.score)
        .map((x) => toDigestSignal(x.signal, entityById, x.severity, x.score, x.pinned)),
    }))
    .filter((cl) => cl.signals.length > 0);

  const date = new Date().toLocaleDateString("de-DE");
  const title = kept.length > 0
    ? `Market Radar Briefing, ${date}`
    : `Market Radar, ${date}: keine relevanten Bewegungen`;

  const { data: digest, error: digestErr } = await c.from("digests").insert({
    company_id: job.company_id,
    type: "competitor",
    title,
    cluster_analyses: clusters,
  }).select().single();
  if (digestErr || !digest) throw new Error(`digest: ${digestErr?.message}`);

  // digest_items pro Signal, damit die geteilte Vote-Mechanik greift.
  if (kept.length > 0) {
    const items = kept.map((x) => ({
      digest_id: digest.id,
      cluster: x.signal.lens,
      title: x.signal.title,
      summary: x.signal.body,
      source_url: x.signal.source_url,
      source_name: x.signal.source_name,
      source_tier: null,
      published_at: x.signal.detected_at,
      raw_json: { signal_id: x.signal.id, severity: x.severity, score: x.score },
    }));
    const { error: itemsErr } = await c.from("digest_items").insert(items);
    if (itemsErr) throw new Error(itemsErr.message);
  }

  const keptIds = kept.map((x) => x.signal.id);
  const droppedIds = dropped.map((x) => x.signal.id);
  if (keptIds.length > 0) {
    await c.from("entity_signals")
      .update({ status: "digested", digest_id: digest.id })
      .in("id", keptIds);
  }
  if (droppedIds.length > 0) {
    await c.from("entity_signals").update({ status: "dropped" }).in("id", droppedIds);
  }

  return {
    digest_id: digest.id,
    signals_total: signals.length,
    signals_kept: keptIds.length,
    signals_dropped: droppedIds.length,
    clusters: clusters.length,
  };
}

// score = 0.35 severity + 0.30 relevance + 0.20 recency + 0.15 source_weight (je 0-100).
function computeScore(s: SignalRow, severity: number): number {
  const severityNorm = severity * 20;
  const relevanceBase = s.signal_type === "page_diff" ? 85 : s.signal_type === "baseline" ? 65 : 60;
  const relevance = Math.min(100, relevanceBase + s.drift_score * 0.2 + (s.why_it_matters ? 0 : -20));
  const recency = recencyScore(s.detected_at);
  const sourceWeight = s.signal_type === "page_diff"
    ? 100
    : s.signal_type === "baseline"
    ? 80
    : (s.source_name ?? "").includes("Hacker News")
    ? 70
    : 60;
  return Math.round(
    0.35 * severityNorm + 0.30 * relevance + 0.20 * recency + 0.15 * sourceWeight,
  );
}

function recencyScore(detectedAt: string): number {
  const ageDays = (Date.now() - new Date(detectedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 60;
  if (ageDays <= 2) return 100;
  if (ageDays >= 7) return 20;
  return Math.round(100 - ((ageDays - 2) / 5) * 80);
}

function toDigestSignal(
  s: SignalRow,
  entityById: Map<string, EntityRow>,
  severity: number,
  score: number,
  pinned: boolean,
): RadarDigestSignal {
  const payload = s.payload ?? {};
  const removed = Array.isArray(payload.removed) ? payload.removed as string[] : [];
  const added = Array.isArray(payload.added) ? payload.added as string[] : [];
  return {
    signal_id: s.id,
    entity_name: entityById.get(s.entity_id)?.name ?? "",
    signal_type: s.signal_type,
    title: s.title,
    what_happened: s.body,
    why_it_matters: s.why_it_matters,
    next_step: s.next_step,
    source_url: s.source_url,
    source_name: s.source_name,
    detected_at: s.detected_at,
    severity,
    score,
    drift_flag: s.drift_score >= 60,
    pinned,
    diff: removed.length > 0 || added.length > 0 ? { removed, added } : null,
  };
}
