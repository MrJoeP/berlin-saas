// radar_snapshot: wöchentlicher Seiten-Snapshot + Diff pro aktiver Entität.
// Fetch-Leiter, Doppel-Fetch, Noise-Gate, LLM-Analyse (severity/drift), Baseline
// beim ersten Lauf. Kein Diff, kein Rauschen. Chained radar_signals.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job } from "../_shared/types.ts";
import { callClaudeJSON, DEFAULT_MODEL } from "../_shared/claude.ts";
import {
  diffTexts,
  fetchStableText,
  normalizeText,
  passesNoiseGate,
  sha256,
} from "./radar_shared.ts";

interface RadarEntityRow {
  id: string;
  company_id: string;
  name: string;
  type: "competitor" | "substitute" | "complement";
  urls: Record<string, string>;
  active: boolean;
  drift_streak: number;
  fetch_health: Record<string, unknown>;
}

interface DiffAnalysis {
  what_happened: string;
  why_it_matters: string;
  next_step: string;
  severity: number;
  drift_score: number;
}

const URL_KINDS = ["landing", "pricing", "changelog"] as const;

const DIFF_PROMPT = `Du bewertest eine Änderung auf der Webseite eines Markt-Akteurs.
Kontext: Unsere Firma "{company}" ({product}). ICP: {icp}.
Der Akteur "{entity}" ist für uns: {lens} (competitor = direkter Konkurrent,
substitute = alternativer Lösungsweg, complement = Ökosystem-Partner).

Severity-Rubrik (streng anwenden):
1 = Wording/Typo/kosmetisch. 2 = kleine Inhaltsänderung. 3 = neues Feature oder
klare Botschaftsänderung. 4 = Pricing-Änderung oder neue Produktlinie.
5 = Strategieschwenk, Kategorie-Wechsel oder direkter Angriff auf unser Feld.

drift_score (0-100): Wie stark bewegt sich der Akteur mit dieser Änderung in
Richtung UNSERES Felds (Produkt + ICP oben)? 0 = gar nicht, 100 = baut exakt
unser Produkt. Für type=competitor immer 0 setzen.

Antworte ausschließlich JSON:
{"what_happened": "1-2 Sätze, was konkret geändert wurde",
 "why_it_matters": "1-2 Sätze Bezug auf unsere Firma/ICP",
 "next_step": "1 Satz, konkreter nächster Schritt für uns",
 "severity": 1-5, "drift_score": 0-100}`;

const BASELINE_PROMPT = `Du erstellst ein kompaktes Erst-Profil eines Markt-Akteurs
auf Basis seiner Webseiten-Texte. Kontext: Unsere Firma "{company}" ({product}), ICP: {icp}.
Der Akteur "{entity}" ist für uns: {lens}.

Antworte ausschließlich JSON:
{"what_happened": "2-3 Sätze: aktuelle Positionierung und Angebot des Akteurs",
 "why_it_matters": "1-2 Sätze: was daran für uns relevant ist",
 "next_step": "1 Satz: was wir im Auge behalten sollten",
 "severity": 2, "drift_score": 0-100}`;

export async function handle(
  job: Job,
  c: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("need company_id");

  const { data: co } = await c
    .from("companies")
    .select("id, name, product_description, icp, keywords")
    .eq("id", job.company_id)
    .single();
  if (!co) throw new Error(`Company ${job.company_id} not found`);

  const { data: entities } = await c
    .from("entities")
    .select("*")
    .eq("company_id", job.company_id)
    .eq("active", true);

  let snapshots = 0;
  let signals = 0;
  let failures = 0;

  for (const entity of (entities ?? []) as RadarEntityRow[]) {
    const health: Record<string, unknown> = { ...(entity.fetch_health ?? {}) };
    const baselineTexts: string[] = [];
    let hadBaselineKind = false;
    let maxDrift = 0;

    for (const kind of URL_KINDS) {
      const url = entity.urls?.[kind];
      if (!url) continue;

      let outcome;
      try {
        outcome = await fetchStableText(url, kind);
      } catch (e) {
        outcome = { ok: false as const, text: "", wordCount: 0, via: "none" as const, error: e instanceof Error ? e.message : String(e) };
      }

      if (!outcome.ok) {
        failures++;
        health[kind] = { status: "failed", checked_at: new Date().toISOString(), error: outcome.error ?? "unbekannt", word_count: outcome.wordCount };
        continue;
      }
      health[kind] = { status: "ok", checked_at: new Date().toISOString(), via: outcome.via, word_count: outcome.wordCount };

      const normalized = normalizeText(outcome.text);
      const hash = await sha256(normalized);

      const { data: prev } = await c
        .from("entity_snapshots")
        .select("id, text_hash, text_extract")
        .eq("entity_id", entity.id)
        .eq("url_kind", kind)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!prev) {
        // Erster Lauf: Snapshot speichern, Text fürs Baseline-Profil sammeln.
        await c.from("entity_snapshots").insert({
          entity_id: entity.id, url_kind: kind, url,
          text_hash: hash, text_extract: normalized.slice(0, 60_000),
          word_count: outcome.wordCount,
        });
        snapshots++;
        baselineTexts.push(`[${kind}]\n${normalized.slice(0, 4000)}`);
        hadBaselineKind = true;
        continue;
      }

      if (prev.text_hash === hash) continue; // unverändert: kein Rauschen

      const diff = diffTexts(prev.text_extract, normalized);
      await c.from("entity_snapshots").insert({
        entity_id: entity.id, url_kind: kind, url,
        text_hash: hash, text_extract: normalized.slice(0, 60_000),
        word_count: outcome.wordCount,
      });
      snapshots++;

      if (!passesNoiseGate(diff)) continue;

      const analysis = await analyzeDiff(co, entity, kind, diff);
      maxDrift = Math.max(maxDrift, analysis.drift_score);
      const severity = clamp(analysis.severity, 1, 5);
      await c.from("entity_signals").insert({
        entity_id: entity.id,
        company_id: job.company_id,
        signal_type: "page_diff",
        title: analysis.what_happened.slice(0, 300),
        body: analysis.what_happened,
        why_it_matters: analysis.why_it_matters,
        next_step: analysis.next_step,
        source_url: url,
        source_name: `${kind}-diff`,
        lens: entity.type,
        tags: [kind, ...(diff.hasPriceChange ? ["pricing"] : [])],
        payload: { removed: diff.removed.slice(0, 12), added: diff.added.slice(0, 12), changed_ratio: Number(diff.changedRatio.toFixed(3)), url_kind: kind },
        severity,
        drift_score: entity.type === "competitor" ? 0 : clamp(analysis.drift_score, 0, 100),
        score: 0, // wird im Digest-Schritt berechnet
      });
      signals++;
    }

    // Baseline-Profil einmal pro Entität, damit das erste Briefing nicht leer ist.
    if (hadBaselineKind && baselineTexts.length > 0) {
      const { count } = await c
        .from("entity_signals")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entity.id)
        .eq("signal_type", "baseline");
      if ((count ?? 0) === 0) {
        const analysis = await analyzeBaseline(co, entity, baselineTexts.join("\n\n"));
        await c.from("entity_signals").insert({
          entity_id: entity.id,
          company_id: job.company_id,
          signal_type: "baseline",
          title: `Baseline: ${entity.name}`,
          body: analysis.what_happened,
          why_it_matters: analysis.why_it_matters,
          next_step: analysis.next_step,
          source_url: entity.urls?.landing ?? entity.urls?.pricing ?? null,
          source_name: "baseline-profil",
          lens: entity.type,
          tags: ["baseline"],
          payload: {},
          severity: 2,
          drift_score: entity.type === "competitor" ? 0 : clamp(analysis.drift_score, 0, 100),
          score: 0,
        });
        signals++;
      }
    }

    // Drift-Streak: zwei Wochen in Folge >= 60 eskaliert im Digest.
    const newStreak = maxDrift >= 60 ? (entity.drift_streak ?? 0) + 1 : 0;
    await c.from("entities").update({ fetch_health: health, drift_streak: newStreak }).eq("id", entity.id);
  }

  // Kette: Mentions/News sammeln, danach Digest.
  const { data: nextJob, error } = await c.from("jobs").insert({
    type: "radar_signals",
    company_id: job.company_id,
    payload: { snapshot_job_id: job.id },
    depends_on: [job.id],
  }).select().single();
  if (error) throw new Error(error.message);

  return { entities: (entities ?? []).length, snapshots, signals, fetch_failures: failures, signals_job_id: nextJob?.id };
}

async function analyzeDiff(
  co: { name: string | null; product_description: string | null; icp: string | null },
  entity: RadarEntityRow,
  kind: string,
  diff: { removed: string[]; added: string[] },
): Promise<DiffAnalysis> {
  const system = DIFF_PROMPT
    .replace("{company}", co.name ?? "")
    .replace("{product}", co.product_description ?? "")
    .replace("{icp}", co.icp ?? "")
    .replace("{entity}", entity.name)
    .replace("{lens}", entity.type);
  const user = `Seite: ${kind}\n\nENTFERNT:\n${diff.removed.join("\n") || "(nichts)"}\n\nNEU:\n${diff.added.join("\n") || "(nichts)"}`;
  try {
    return await callClaudeJSON<DiffAnalysis>({
      model: DEFAULT_MODEL,
      system,
      messages: [{ role: "user", content: user.slice(0, 6000) }],
      max_tokens: 500,
      temperature: 0,
    });
  } catch {
    return {
      what_happened: `Änderung auf der ${kind}-Seite von ${entity.name}.`,
      why_it_matters: "",
      next_step: "Änderung manuell prüfen.",
      severity: 2,
      drift_score: 0,
    };
  }
}

async function analyzeBaseline(
  co: { name: string | null; product_description: string | null; icp: string | null },
  entity: RadarEntityRow,
  pagesText: string,
): Promise<DiffAnalysis> {
  const system = BASELINE_PROMPT
    .replace("{company}", co.name ?? "")
    .replace("{product}", co.product_description ?? "")
    .replace("{icp}", co.icp ?? "")
    .replace("{entity}", entity.name)
    .replace("{lens}", entity.type);
  try {
    return await callClaudeJSON<DiffAnalysis>({
      model: DEFAULT_MODEL,
      system,
      messages: [{ role: "user", content: pagesText.slice(0, 9000) }],
      max_tokens: 500,
      temperature: 0,
    });
  } catch {
    return {
      what_happened: `${entity.name} wird ab jetzt beobachtet.`,
      why_it_matters: "",
      next_step: "",
      severity: 2,
      drift_score: 0,
    };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)));
}
