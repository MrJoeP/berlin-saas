import { ArrowBigDown, ArrowBigUp, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { type DigestItem } from "@/lib/supabase";

type PublishedItem = {
  title: string;
  url: string;
  score: number | null;
  source: string;
  published_at?: string | null;
  summary?: string;
  why_relevant?: string;
  strategic_value?: string;
  key_takeaways?: string[];
};

export interface PublishedContentCluster {
  topic_name?: string;
  content_type?: string;
  source_mix?: string[];
  summary?: string;
  why_relevant?: string;
  key_takeaways?: string[];
  published_items?: PublishedItem[];
  // Legacy digests created before the published-content rewrite.
  topic?: string;
  plattform_mix?: string[];
  zusammenfassung?: string;
  warum_relevant?: string;
  key_insight?: string;
  beispiele?: PublishedItem[];
  pattern_name?: string;
}

export interface TopPostDigestProps {
  clusterAnalyses: PublishedContentCluster[];
  items: DigestItem[];
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
}

function VoteButtons({
  itemId,
  myVote,
  onVote,
}: {
  itemId?: string;
  myVote: -1 | 1 | undefined;
  onVote: (id: string, dir: "up" | "down") => void;
}) {
  if (!itemId) return null;
  return (
    <div className="shrink-0 flex flex-col items-center justify-center w-7">
      <button
        type="button"
        onClick={() => onVote(itemId, "up")}
        className={`p-0.5 rounded transition-colors ${
          myVote === 1
            ? "bg-emerald-100 text-emerald-700"
            : "text-[var(--color-muted)] hover:bg-emerald-50 hover:text-emerald-600"
        }`}
        title="Mehr davon"
      >
        <ArrowBigUp className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onVote(itemId, "down")}
        className={`p-0.5 rounded transition-colors mt-0.5 ${
          myVote === -1
            ? "bg-red-100 text-red-700"
            : "text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600"
        }`}
        title="Weniger davon"
      >
        <ArrowBigDown className="w-4 h-4" />
      </button>
    </div>
  );
}

export function TopPostDigest({ clusterAnalyses, items, onVote, votes }: TopPostDigestProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const itemByUrl = useMemo(() => {
    const map = new Map<string, DigestItem>();
    for (const item of items) {
      if (item.source_url) map.set(item.source_url, item);
    }
    return map;
  }, [items]);

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function voteMeta(url: string) {
    const digestItem = itemByUrl.get(url);
    return {
      itemId: digestItem?.id,
      myVote: digestItem ? votes[`item:${digestItem.id}`] : undefined,
    };
  }

  const clusters = (clusterAnalyses ?? [])
    .map((cluster) => {
      const topic = cluster.topic_name ?? cluster.topic ?? cluster.pattern_name ?? "Unbekanntes Thema";
      const sourceMix = cluster.source_mix ?? cluster.plattform_mix ?? [];
      const summary = cluster.summary ?? cluster.zusammenfassung ?? "";
      const whyRelevant = cluster.why_relevant ?? cluster.warum_relevant ?? "";
      const publishedItems = cluster.published_items ?? cluster.beispiele ?? [];
      return {
        ...cluster,
        topic,
        sourceMix,
        summary,
        whyRelevant,
        publishedItems,
      };
    })
    .filter((cluster) => cluster.summary || cluster.publishedItems.length > 0);

  if (clusters.length === 0) {
    return <p className="text-sm text-[var(--color-muted)] py-4">Keine veröffentlichten Inhalte gefunden.</p>;
  }

  const topItems = clusters
    .flatMap((cluster) => cluster.publishedItems)
    .filter((item) => item.title && item.url)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {topItems.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Top 10 veröffentlichte Artikel & Beiträge
          </div>
          <div className="grid gap-3">
            {topItems.map((item, idx) => {
              const { itemId, myVote } = voteMeta(item.url);
              return (
                <article
                  key={`${item.url}-${idx}`}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex items-start gap-3">
                    <VoteButtons itemId={itemId} myVote={myVote} onVote={onVote} />
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug flex items-start gap-1"
                      >
                        <span className="flex-1">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
                        <span>{item.source}</span>
                        {item.published_at && <span>{new Date(item.published_at).toLocaleDateString("de-DE")}</span>}
                        {item.score != null && <span className="font-medium text-amber-700">▲ {item.score}</span>}
                      </div>
                      {item.summary && (
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg)]">{item.summary}</p>
                      )}
                      {item.why_relevant && (
                        <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                          {item.why_relevant}
                        </p>
                      )}
                      {item.strategic_value && (
                        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Mehrwert
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-emerald-950">
                            {item.strategic_value}
                          </p>
                        </div>
                      )}
                      {item.key_takeaways && item.key_takeaways.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {item.key_takeaways.slice(0, 3).map((takeaway, takeawayIdx) => (
                            <li key={takeawayIdx} className="text-xs leading-relaxed text-[var(--color-muted)]">
                              {takeaway}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {clusters.map((cluster) => (
          <button
            key={cluster.topic}
            type="button"
            onClick={() => setOpen((prev) => ({ ...prev, [cluster.topic]: true }))}
            className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:opacity-80 bg-[var(--color-surface)] text-[var(--color-fg)] border-[var(--color-border)]"
          >
            {cluster.topic}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {clusters.map((cluster) => {
          const isOpen = open[cluster.topic] ?? clusters.length === 1;
          const preview = cluster.summary ||
            cluster.key_insight ||
            cluster.publishedItems.slice(0, 2).map((item) => item.title).join(" · ");
          return (
            <div key={cluster.topic} className="border border-[var(--color-border)] rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(cluster.topic)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg)] transition-colors text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold block truncate">{cluster.topic}</span>
                  {!isOpen && preview && (
                    <span className="text-[11px] text-[var(--color-muted)] block truncate">
                      {preview.length > 110 ? `${preview.slice(0, 110)}...` : preview}
                    </span>
                  )}
                </span>
                {cluster.content_type && (
                  <span className="shrink-0 text-[10px] text-[var(--color-muted)] capitalize">
                    {cluster.content_type}
                  </span>
                )}
                {cluster.sourceMix.length > 1 && (
                  <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                    {cluster.sourceMix.length} Quellen
                  </span>
                )}
                <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                  {cluster.publishedItems.length} Inhalte
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-3 border-t border-[var(--color-border)] space-y-4">
                  {cluster.sourceMix.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cluster.sourceMix.map((source) => (
                        <span
                          key={source}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  )}

                  {cluster.summary && (
                    <p className="text-sm leading-relaxed text-[var(--color-fg)]">{cluster.summary}</p>
                  )}

                  {cluster.whyRelevant && (
                    <div className="p-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                        Warum relevant
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--color-fg)]">{cluster.whyRelevant}</p>
                    </div>
                  )}

                  {cluster.key_takeaways && cluster.key_takeaways.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                        Takeaways
                      </div>
                      <ul className="space-y-1.5">
                        {cluster.key_takeaways.map((takeaway, idx) => (
                          <li key={idx} className="text-sm leading-relaxed text-[var(--color-fg)]">
                            {takeaway}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cluster.publishedItems.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                        Veröffentlichte Artikel & Beiträge ({cluster.publishedItems.length})
                      </div>
                      <ul className="space-y-2">
                        {cluster.publishedItems.map((item, idx) => {
                          const { itemId, myVote } = voteMeta(item.url);
                          return (
                            <li key={`${item.url}-${idx}`} className="flex items-start gap-2">
                              <VoteButtons itemId={itemId} myVote={myVote} onVote={onVote} />
                              {item.score != null && (
                                <span className="shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  ▲ {item.score}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug flex items-start gap-1"
                                >
                                  <span className="flex-1">{item.title}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-50" />
                                </a>
                                <span className="text-[10px] text-[var(--color-muted)]">
                                  {item.source}
                                  {item.published_at ? ` · ${new Date(item.published_at).toLocaleDateString("de-DE")}` : ""}
                                </span>
                                {item.summary && (
                                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                                    {item.summary}
                                  </p>
                                )}
                                {item.strategic_value && (
                                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                                    Mehrwert: {item.strategic_value}
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
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
