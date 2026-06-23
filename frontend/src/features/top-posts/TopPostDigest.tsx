import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";

export interface HookCluster {
  pattern_name: string;
  was_geht_viral: string;
  warum_es_funktioniert: string;
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
    <div className="space-y-1">
      {clusterAnalyses.map((cluster) => {
        const isOpen = !!open[cluster.pattern_name];
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
              <span className="text-sm font-semibold flex-1 truncate">{cluster.pattern_name}</span>
              <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                {cluster.beispiele?.length ?? 0} Posts
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-3 border-t border-[var(--color-border)] space-y-4">
                {cluster.was_geht_viral && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
                      Was viral geht
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--color-fg)]">
                      {cluster.was_geht_viral}
                    </p>
                  </div>
                )}

                {cluster.warum_es_funktioniert && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
                      Warum es funktioniert
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--color-fg)]">
                      {cluster.warum_es_funktioniert}
                    </p>
                  </div>
                )}

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
  );
}
