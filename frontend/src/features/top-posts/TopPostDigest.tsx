import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";

export interface HookCluster {
  pattern_name: string;
  format_typ?: string;
  was_geht_viral: string;
  warum_es_funktioniert: string;
  hook_einstieg?: string;
  zielgruppe_reaktion?: string;
  plattform_staerke?: string;
  plattform_mix?: string[];
  winkel_fuer_eigenen_post: string;
  beispiele: {
    title: string;
    url: string;
    score: number | null;
    source: string;
  }[];
}

export interface TopPostDigestProps {
  clusterAnalyses: HookCluster[];
}

const FORMAT_LABELS: Record<string, string> = {
  frage: "Frage",
  stat: "Stat",
  story: "Story",
  liste: "Liste",
  kontroverse: "Kontroverse",
  insight: "Insight",
  case_study: "Case Study",
  news_hook: "News Hook",
};

const FORMAT_COLORS: Record<string, string> = {
  frage: "bg-blue-50 text-blue-700 border-blue-200",
  stat: "bg-amber-50 text-amber-700 border-amber-200",
  story: "bg-purple-50 text-purple-700 border-purple-200",
  liste: "bg-slate-50 text-slate-700 border-slate-200",
  kontroverse: "bg-red-50 text-red-700 border-red-200",
  insight: "bg-emerald-50 text-emerald-700 border-emerald-200",
  case_study: "bg-orange-50 text-orange-700 border-orange-200",
  news_hook: "bg-sky-50 text-sky-700 border-sky-200",
};

function AnalysisRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
        {label}
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-fg)]">{value}</p>
    </div>
  );
}

export function TopPostDigest({ clusterAnalyses }: TopPostDigestProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (!clusterAnalyses || clusterAnalyses.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-4">Keine Hook-Muster gefunden.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Übersicht aller Muster */}
      <div className="flex flex-wrap gap-1.5">
        {clusterAnalyses.map((cluster) => {
          const fmt = cluster.format_typ?.toLowerCase() ?? "";
          const fmtColor = FORMAT_COLORS[fmt] ?? "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]";
          return (
            <button
              key={cluster.pattern_name}
              type="button"
              onClick={() => setOpen((prev) => ({ ...prev, [cluster.pattern_name]: true }))}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:opacity-80 ${fmtColor}`}
            >
              {cluster.pattern_name}
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
      {clusterAnalyses.map((cluster) => {
        const isOpen = !!open[cluster.pattern_name];
        const fmt = cluster.format_typ?.toLowerCase() ?? "";
        const fmtLabel = FORMAT_LABELS[fmt];
        const fmtColor = FORMAT_COLORS[fmt] ?? "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]";

        return (
          <div
            key={cluster.pattern_name}
            className="border border-[var(--color-border)] rounded-md overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(cluster.pattern_name)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg)] transition-colors text-left"
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
              )}
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold block truncate">{cluster.pattern_name}</span>
                {!isOpen && cluster.beispiele?.length > 0 && (
                  <span className="text-[11px] text-[var(--color-muted)] block truncate">
                    {cluster.beispiele.slice(0, 2).map(b => b.title.length > 35 ? b.title.slice(0, 35) + "…" : b.title).join(" · ")}
                  </span>
                )}
              </span>
              {fmtLabel && (
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${fmtColor}`}>
                  {fmtLabel}
                </span>
              )}
              {cluster.plattform_mix && cluster.plattform_mix.length > 1 && (
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                  {cluster.plattform_mix.length} Quellen
                </span>
              )}
              <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                {cluster.beispiele?.length ?? 0} Posts
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-[var(--color-border)] space-y-4">
                {/* Platform mix */}
                {cluster.plattform_mix && cluster.plattform_mix.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cluster.plattform_mix.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]">
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                <AnalysisRow label="Was viral geht" value={cluster.was_geht_viral} />
                <AnalysisRow label="Hook-Einstieg" value={cluster.hook_einstieg ?? ""} />
                <AnalysisRow label="Warum es funktioniert" value={cluster.warum_es_funktioniert} />
                <AnalysisRow label="Zielgruppe" value={cluster.zielgruppe_reaktion ?? ""} />
                <AnalysisRow label="Beste Plattform" value={cluster.plattform_staerke ?? ""} />

                {cluster.winkel_fuer_eigenen_post && (
                  <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                      Dein Winkel
                    </div>
                    <p className="text-sm leading-relaxed text-emerald-900">
                      {cluster.winkel_fuer_eigenen_post}
                    </p>
                  </div>
                )}

                {cluster.beispiele?.length > 0 && (
                  <details open>
                    <summary className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg)]">
                      Beispiele ({cluster.beispiele.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {cluster.beispiele.map((ex, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          {ex.score != null && (
                            <span className="shrink-0 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              ▲ {ex.score}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={ex.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug flex items-start gap-1"
                            >
                              <span className="flex-1">{ex.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-50" />
                            </a>
                            <span className="text-[10px] text-[var(--color-muted)]">{ex.source}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
