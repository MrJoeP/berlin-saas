import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Zeigt, was der Relevanz-Algorithmus aus den Votes gelernt hat.
// Formeln spiegeln supabase/functions/_shared/relevance.ts (Half-Life 8 Wochen,
// Cold-Start ab 3 Votes, clamp [0.5, 2.0]) — Anzeige-Layer, die echte
// Gewichtung passiert im Worker.

interface VoteSignalRow {
  source_name: string | null;
  title: string | null;
  value: number;
  created_at: string;
}

interface Learned {
  voteCount: number;
  boosted: { source: string; weight: number }[];
  muted: { source: string; weight: number }[];
  interest: string[];
  negative: string[];
}

const DECAY_DAYS = 56 / Math.LN2;

function decay(createdAt: string): number {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return Math.exp(-ageDays / DECAY_DAYS);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-,.&/():;!?]+/)
    .map((t) => t.trim())
    .map((t) => (t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 3);
}

function computeLearned(rows: VoteSignalRow[]): Learned {
  const bySource = new Map<string, { net: number; count: number }>();
  const tokenNet = new Map<string, number>();

  for (const row of rows) {
    const factor = row.value * decay(row.created_at);
    if (row.source_name) {
      const entry = bySource.get(row.source_name) ?? { net: 0, count: 0 };
      entry.net += factor;
      entry.count += 1;
      bySource.set(row.source_name, entry);
    }
    if (row.title) {
      for (const token of new Set(tokenize(row.title))) {
        tokenNet.set(token, (tokenNet.get(token) ?? 0) + factor);
      }
    }
  }

  const weighted = [...bySource.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([source, v]) => ({
      source,
      weight: Math.min(2.0, Math.max(0.5, 1 + v.net / 5)),
    }));

  const tokens = [...tokenNet.entries()];
  return {
    voteCount: rows.length,
    boosted: weighted.filter((w) => w.weight > 1.05).sort((a, b) => b.weight - a.weight).slice(0, 6),
    muted: weighted.filter((w) => w.weight < 0.95).sort((a, b) => a.weight - b.weight).slice(0, 6),
    interest: tokens.filter(([, n]) => n >= 1.5).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t),
    negative: tokens.filter(([, n]) => n <= -1.5).sort((a, b) => a[1] - b[1]).slice(0, 10).map(([t]) => t),
  };
}

export function LearnedPreferences({
  companyId,
  digestType,
}: {
  companyId: string;
  digestType: "niche_news" | "top_post";
}) {
  const [learned, setLearned] = useState<Learned | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("vote_item_signals")
      .select("source_name, title, value, created_at")
      .eq("company_id", companyId)
      .eq("digest_type", digestType)
      .then(({ data }) => {
        if (!cancelled) setLearned(computeLearned((data ?? []) as VoteSignalRow[]));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, digestType]);

  if (!learned) return null;

  const hasSignal = learned.boosted.length > 0 || learned.muted.length > 0 ||
    learned.interest.length > 0 || learned.negative.length > 0;

  return (
    <div className="mb-6 border border-[var(--color-border)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg)] transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
        )}
        <Sparkles className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
        <span className="text-sm font-semibold flex-1">Gelernte Präferenzen</span>
        <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
          {learned.voteCount} Votes
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-[var(--color-border)] space-y-3">
          {!hasSignal && (
            <p className="text-xs text-[var(--color-muted)]">
              Noch kein gelerntes Profil. Vote Beiträge und Themen im Briefing (▲/▼) —
              ab ~3 Votes pro Quelle passt sich das Ranking im nächsten Report an.
            </p>
          )}
          {learned.boosted.length > 0 && (
            <PrefRow
              label="Geboostete Quellen"
              chips={learned.boosted.map((b) => `${b.source} ×${b.weight.toFixed(1)}`)}
              tone="positive"
            />
          )}
          {learned.muted.length > 0 && (
            <PrefRow
              label="Gedämpfte Quellen"
              chips={learned.muted.map((m) => `${m.source} ×${m.weight.toFixed(1)}`)}
              tone="negative"
            />
          )}
          {learned.interest.length > 0 && (
            <PrefRow label="Gelernte Interessen" chips={learned.interest} tone="positive" />
          )}
          {learned.negative.length > 0 && (
            <PrefRow label="Gelernte No-Gos" chips={learned.negative} tone="negative" />
          )}
          {hasSignal && (
            <p className="text-[10px] text-[var(--color-muted)]">
              Wirkt ab dem nächsten Scrape. Votes verblassen mit ~8 Wochen Half-Life;
              gedämpfte Quellen können sich durch neue Upvotes rehabilitieren.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PrefRow({
  label,
  chips,
  tone,
}: {
  label: string;
  chips: string[];
  tone: "positive" | "negative";
}) {
  const chipClass = tone === "positive"
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-red-50 text-red-800 border-red-200";
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className={`text-xs px-2 py-0.5 rounded-full border ${chipClass}`}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
