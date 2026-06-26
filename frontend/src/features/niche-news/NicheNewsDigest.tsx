import { ChevronDown, ChevronRight, ArrowBigUp, ArrowBigDown } from "lucide-react";
import { type DigestItem, type ClusterAnalysis } from "@/lib/supabase";

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-amber-100 text-amber-800 border-amber-300",
};
const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "T1 · Primärquelle",
  2: "T2 · Editorial",
  3: "T3 · Community",
};

const ACTION_LABELS: Record<NonNullable<ClusterAnalysis["signal_metrics"]>["action_hint"], string> = {
  act: "Prüfen",
  watch: "Beobachten",
  content: "Content-Idee",
  ignore: "Ignorieren",
};

export interface NicheNewsDigestProps {
  items: DigestItem[];
  digestId: string;
  analyses: ClusterAnalysis[];
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
  onVoteCluster: (digestId: string, clusterName: string, dir: "up" | "down") => void;
}

export function NicheNewsDigest({
  items,
  digestId,
  analyses,
  expanded,
  toggle,
  onVote,
  votes,
  onVoteCluster,
}: NicheNewsDigestProps) {
  const grouped = groupByCluster(items);
  const sortedAnalyses = [...analyses].sort(
    (a, b) => (b.signal_metrics?.priority_score ?? 0) - (a.signal_metrics?.priority_score ?? 0),
  );

  const allClusters: [string, DigestItem[]][] = Object.entries(grouped).filter(
    ([, clusterItems]) => clusterItems[0]?.cluster_confidence !== "community",
  );
  const sortedClusters = sortClusterEntries(allClusters, analyses);

  return (
    <>
      {sortedAnalyses.length > 0 && <BriefingSummary analyses={sortedAnalyses} />}
      <div className="space-y-1">
        {sortedClusters.map(([clusterName, clusterItems]) => {
          const confidence = clusterItems[0]?.cluster_confidence ?? null;
          const key = `${digestId}|${clusterName}`;
          const isOpen = !!expanded[key];
          const analysis = analyses.find((a) => a.cluster_name === clusterName);
          const myClusterVote = votes[`cluster:${digestId}|${clusterName}`];
          const metrics = analysis?.signal_metrics;
          return (
            <div key={clusterName} className="border border-[var(--color-border)] rounded-md overflow-hidden">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg)] transition-colors text-left min-w-0"
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                  )}
                  <span className="text-sm font-semibold flex-1 truncate">{clusterName}</span>
                  {metrics && (
                    <span
                      className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white tabular-nums"
                      title={metrics.signal_reason}
                    >
                      {metrics.priority_score}
                    </span>
                  )}
                  {metrics && (metrics.action_hint === "act" || metrics.action_hint === "content") && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-white text-[var(--color-fg)] border-[var(--color-border)]">
                      {ACTION_LABELS[metrics.action_hint]}
                    </span>
                  )}
                  {confidence && (
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        confidence === "verified"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : confidence === "editorial"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                      title={analysis?.confidence_reason}
                    >
                      {confidence === "verified" ? "Verifiziert" : confidence === "editorial" ? "Berichterstattung" : "Diskussion"}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">{clusterItems.length}</span>
                </button>
                <div className="flex flex-col border-l border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => onVoteCluster(digestId, clusterName, "up")}
                    className={`flex-1 px-2 transition-colors ${
                      myClusterVote === 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-[var(--color-muted)] hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                  >
                    <ArrowBigUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onVoteCluster(digestId, clusterName, "down")}
                    className={`flex-1 px-2 transition-colors border-t border-[var(--color-border)] ${
                      myClusterVote === -1
                        ? "bg-red-100 text-red-700"
                        : "text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    <ArrowBigDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 border-t border-[var(--color-border)]">
                  {analysis?.confidence_reason && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {analysis.confidence_reason}
                      </span>
                      {metrics && (
                        <>
                          <span className="text-[10px] text-[var(--color-muted)]">· Relevanz {metrics.relevance_score}</span>
                          <span className="text-[10px] text-[var(--color-muted)]">· Evidenz {metrics.evidence_score}</span>
                          <span className="text-[10px] text-[var(--color-muted)]">· Momentum {metrics.momentum_score}</span>
                          <span className="text-[10px] text-[var(--color-muted)]">· Neuheit {metrics.novelty_score}</span>
                        </>
                      )}
                    </div>
                  )}
                  {analysis ? (
                    <DeepAnalysisView analysis={analysis} items={clusterItems} onVote={onVote} votes={votes} />
                  ) : (
                    <div className="pt-2">
                      <ItemList items={clusterItems} onVote={onVote} votes={votes} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function sortClusterEntries(entries: [string, DigestItem[]][], analyses: ClusterAnalysis[]) {
  return [...entries].sort((a, b) =>
    (analysisForCluster(b[0], analyses)?.signal_metrics?.priority_score ?? 0) -
    (analysisForCluster(a[0], analyses)?.signal_metrics?.priority_score ?? 0)
  );
}

function analysisForCluster(clusterName: string, analyses: ClusterAnalysis[]) {
  return analyses.find((a) => a.cluster_name === clusterName);
}

function BriefingSummary({ analyses }: { analyses: ClusterAnalysis[] }) {
  const topSignals = analyses.filter((a) => a.signal_metrics).slice(0, 3);
  if (topSignals.length === 0) return null;
  return (
    <div className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-2">
        Wichtigste Signale
      </div>
      <div className="grid gap-2">
        {topSignals.map((analysis) => (
          <div key={analysis.cluster_name} className="flex items-start gap-2">
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white tabular-nums">
              {analysis.signal_metrics?.priority_score}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{analysis.cluster_name}</div>
              <p className="text-xs text-[var(--color-muted)] leading-snug">
                {analysis.warum_relevant || analysis.signal_metrics?.signal_reason}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByCluster(items: DigestItem[]): Record<string, DigestItem[]> {
  const out: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const key = item.cluster ?? "Sonstiges";
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}

function ItemRow({
  item,
  onVote,
  myVote,
}: {
  item: DigestItem;
  onVote: (id: string, dir: "up" | "down") => void;
  myVote: -1 | 1 | undefined;
}) {
  const tier = (item.source_tier ?? 3) as 1 | 2 | 3;
  return (
    <li className="flex items-start gap-2 group">
      <div className="shrink-0 mt-0.5 flex flex-col items-center justify-center w-7">
        <button
          type="button"
          onClick={() => onVote(item.id, "up")}
          className={`p-0.5 rounded transition-colors ${
            myVote === 1
              ? "bg-emerald-100 text-emerald-700"
              : "text-[var(--color-muted)] hover:bg-emerald-50 hover:text-emerald-600"
          }`}
        >
          <ArrowBigUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onVote(item.id, "down")}
          className={`p-0.5 rounded transition-colors mt-0.5 ${
            myVote === -1
              ? "bg-red-100 text-red-700"
              : "text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600"
          }`}
        >
          <ArrowBigDown className="w-4 h-4" />
        </button>
      </div>
      <span
        className={`shrink-0 mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${TIER_COLORS[tier]}`}
        title={TIER_LABELS[tier]}
      >
        T{tier}
      </span>
      <div className="flex-1 min-w-0 mt-0.5">
        <a
          href={item.source_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug"
        >
          {item.title}
        </a>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">{item.source_name}</span>
        </div>
      </div>
    </li>
  );
}

function ItemList({
  items,
  onVote,
  votes,
}: {
  items: DigestItem[];
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onVote={onVote} myVote={votes[`item:${item.id}`]} />
      ))}
    </ul>
  );
}

function DeepAnalysisView({
  analysis,
  items,
  onVote,
  votes,
}: {
  analysis: ClusterAnalysis;
  items: DigestItem[];
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
}) {
  return (
    <div className="pt-3 space-y-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
          Was passiert ist
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-fg)]">{analysis.was_passiert}</p>
      </div>
      {analysis.warum_relevant && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
            Warum relevant
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-fg)]">{analysis.warum_relevant}</p>
        </div>
      )}
      {analysis.einordnung && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
            Einordnung
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-fg)]">{analysis.einordnung}</p>
        </div>
      )}
      {analysis.next_move && (
        <div className="rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
            Umgang damit
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-fg)]">{analysis.next_move}</p>
        </div>
      )}
      {analysis.offene_fragen && analysis.offene_fragen.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
            Offene Fragen
          </div>
          <ul className="space-y-1">
            {analysis.offene_fragen.map((q) => (
              <li key={q} className="text-sm text-[var(--color-muted)]">• {q}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.key_quotes?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1.5">
            Zitate
          </div>
          <div className="space-y-2">
            {analysis.key_quotes.map((q, idx) => (
              <blockquote key={idx} className="border-l-2 border-[var(--color-accent)] pl-3 py-1">
                <p className="text-sm italic text-[var(--color-fg)]">"{q.quote}"</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  —{" "}
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                    {q.source}
                  </a>
                </p>
              </blockquote>
            ))}
          </div>
        </div>
      )}
      <details className="pt-2 border-t border-[var(--color-border)]" open>
        <summary className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg)]">
          Alle Quellen ({items.length})
        </summary>
        <div className="mt-2">
          <ItemList items={items} onVote={onVote} votes={votes} />
        </div>
      </details>
    </div>
  );
}

