import { ArrowBigDown, ArrowBigUp, ExternalLink } from "lucide-react";
import { useMemo } from "react";
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
  const itemByUrl = useMemo(() => {
    const map = new Map<string, DigestItem>();
    for (const item of items) {
      if (item.source_url) map.set(item.source_url, item);
    }
    return map;
  }, [items]);

  function voteMeta(url: string) {
    const digestItem = itemByUrl.get(url);
    return {
      itemId: digestItem?.id,
      myVote: digestItem ? votes[`item:${digestItem.id}`] : undefined,
    };
  }

  const clusters = (clusterAnalyses ?? [])
    .map((cluster) => {
      const topic = cluster.topic_name ?? cluster.topic ?? cluster.pattern_name ?? "Veröffentlichte Inhalte";
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

  const topItems = clusters
    .flatMap((cluster) => cluster.publishedItems)
    .filter((item) => item.title && item.url)
    .slice(0, 10);

  if (topItems.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-4">
        Keine veröffentlichten Inhalte in diesem Digest. Falls er aus einer älteren Version stammt, sammle die Veröffentlichungen neu, um die aktuelle Top-10-Ansicht zu sehen.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Top 10 veröffentlichte Artikel & Beiträge mit Kurzfassung
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
                        <div className="mt-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                            Kurzfassung
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                            {item.summary}
                          </p>
                        </div>
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
    </div>
  );
}
