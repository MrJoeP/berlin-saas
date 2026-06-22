import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, ChevronDown, ChevronRight, ArrowBigUp, ArrowBigDown, Plus, LogOut } from "lucide-react";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type ClusterAnalysis,
  type Vote,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { formatDate, formatRelative } from "@/lib/utils";

interface DigestWithItems extends Digest {
  items: DigestItem[];
}

type DigestFilter = Digest["type"] | "all";

const TYPE_LABELS: Record<Digest["type"], string> = {
  niche_news: "Niche News",
  top_post: "Top Posts",
  competitor: "Wettbewerb",
  ugc: "UGC",
};

const TYPE_COLORS: Record<Digest["type"], string> = {
  niche_news: "bg-[var(--color-accent)] text-white",
  top_post: "bg-emerald-600 text-white",
  competitor: "bg-purple-600 text-white",
  ugc: "bg-orange-500 text-white",
};

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "T1 · Primärquelle",
  2: "T2 · Editorial",
  3: "T3 · Community",
};

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-amber-100 text-amber-800 border-amber-300",
};

const CONFIDENCE_LABELS: Record<"verified" | "editorial" | "community", string> = {
  verified: "Verifiziert",
  editorial: "Berichterstattung",
  community: "Diskussion",
};

function KeywordsEditor({
  keywords,
  onSave,
}: {
  keywords: string[];
  onSave: (next: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(keywords.join(", "));

  function start() {
    setDraft(keywords.join(", "));
    setEditing(true);
  }

  async function commit() {
    const next = Array.from(
      new Set(
        draft
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      ),
    );
    await onSave(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mb-6 p-3 border border-[var(--color-accent)] rounded-md bg-[var(--color-bg)]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-2">
          Buzzwords (komma-getrennt) — steuern Pre-Filter & Themen-Fokus
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          rows={2}
          placeholder="z.B. SEO Agentur, Content SEO, AI Overviews, AIO, Backlinks, Keyword Research"
          autoFocus
        />
        <div className="flex gap-2 mt-2 justify-end">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs px-3 py-1 rounded text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={commit}
            className="text-xs px-3 py-1 rounded bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Speichern
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)] mt-2">
          Wirkt ab dem nächsten Scrape. Tier-2- und Tier-3-Quellen werden nach diesen Begriffen gefiltert. Tier-1 (Primärquellen) bleiben immer rein.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-2 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mt-1.5">
        Buzzwords:
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {keywords.length === 0 ? (
          <span className="text-xs text-[var(--color-muted)] italic mt-1.5">
            Keine gesetzt — alle Quellen-Items kommen rein.
          </span>
        ) : (
          keywords.map((k) => (
            <span
              key={k}
              className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)]"
            >
              {k}
            </span>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={start}
        className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
      >
        Bearbeiten
      </button>
    </div>
  );
}

// Plattform-Mapping aus source_name. Für Community-News-Gruppierung.
function detectPlatform(sourceName: string | null): string {
  if (!sourceName) return "Andere";
  const s = sourceName.toLowerCase();
  if (s.startsWith("r/")) return "Reddit";
  if (s.includes("hacker news") || s.startsWith("hn ")) return "Hacker News";
  if (s.includes("product hunt") || s === "producthunt") return "Product Hunt";
  if (s.startsWith("x ·") || s.startsWith("x.com") || s.includes("twitter")) return "Twitter/X";
  if (s.startsWith("youtube ·") || s.includes("youtube")) return "YouTube";
  if (s.startsWith("linkedin ·") || s.includes("linkedin")) return "LinkedIn";
  return sourceName;
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
          title={myVote === 1 ? "Upvote entfernen" : "Upvote"}
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
          title={myVote === -1 ? "Downvote entfernen" : "Downvote"}
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
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          {item.title}
        </a>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">
          {item.source_name}
          {item.published_at && (
            <span className="ml-2">· {formatRelative(item.published_at)}</span>
          )}
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
        <ItemRow
          key={item.id}
          item={item}
          onVote={onVote}
          myVote={votes[`item:${item.id}`]}
        />
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
        <p className="text-sm leading-relaxed text-[var(--color-fg)]">
          {analysis.was_passiert}
        </p>
      </div>
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
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-accent)] hover:underline"
                  >
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

// Community-News: T3-Items nach Plattform gruppiert (Reddit, HN, Twitter/X, YouTube, LinkedIn).
// Keine LLM-Synthese, reine Sammlung mit Upvote-Funktion.
function CommunitySection({
  items,
  digestId,
  expanded,
  toggle,
  onVote,
  votes,
}: {
  items: DigestItem[];
  digestId: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
}) {
  const byPlatform: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const platform = detectPlatform(item.source_name);
    if (!byPlatform[platform]) byPlatform[platform] = [];
    byPlatform[platform].push(item);
  }
  // Sort: höchstes Netto-Voting zuerst (Summe meiner Votes für Items dieser Plattform), dann Item-Anzahl.
  const platformScore = (items: DigestItem[]) =>
    items.reduce((s, i) => s + (votes[`item:${i.id}`] ?? 0), 0);
  const entries = Object.entries(byPlatform).sort((a, b) => {
    const sA = platformScore(a[1]);
    const sB = platformScore(b[1]);
    if (sA !== sB) return sB - sA;
    return b[1].length - a[1].length;
  });
  return (
    <div className="mb-6 last:mb-0 opacity-95">
      <div className="flex items-baseline gap-2 mb-3 pb-2 border-b border-[var(--color-border)]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
          Community News
        </h2>
        <span className="text-[10px] text-[var(--color-muted)]">
          Reddit, Hacker News, Twitter/X, YouTube, LinkedIn · roh, ungeprüft
        </span>
      </div>
      <div className="space-y-1">
        {entries.map(([platform, platformItems]) => {
          const key = `${digestId}|community|${platform}`;
          const isOpen = !!expanded[key];
          const score = platformScore(platformItems);
          return (
            <div key={platform} className="border border-[var(--color-border)] rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg)] transition-colors text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-muted)]" />
                )}
                <span className="text-sm font-semibold flex-1 truncate">{platform}</span>
                {score !== 0 && (
                  <span
                    className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      score > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {score > 0 ? `▲ +${score}` : `▼ ${score}`}
                  </span>
                )}
                <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                  {platformItems.length}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-2 border-t border-[var(--color-border)]">
                  <ItemList
                    items={[...platformItems].sort((a, b) => {
                      const sa = votes[`item:${a.id}`] ?? 0;
                      const sb = votes[`item:${b.id}`] ?? 0;
                      return sb - sa;
                    })}
                    onVote={onVote}
                    votes={votes}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  clusters,
  digestId,
  expanded,
  toggle,
  analyses,
  onVote,
  votes,
  onVoteCluster,
  dimmed = false,
}: {
  title: string;
  hint: string;
  clusters: [string, DigestItem[]][];
  digestId: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  analyses: ClusterAnalysis[];
  onVote: (id: string, dir: "up" | "down") => void;
  votes: Record<string, -1 | 1>;
  onVoteCluster: (digestId: string, clusterName: string, dir: "up" | "down") => void;
  dimmed?: boolean;
}) {
  return (
    <div className={`mb-6 last:mb-0 ${dimmed ? "opacity-90" : ""}`}>
      <div className="flex items-baseline gap-2 mb-3 pb-2 border-b border-[var(--color-border)]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
          {title}
        </h2>
        <span className="text-[10px] text-[var(--color-muted)]">{hint}</span>
      </div>
      <div className="space-y-1">
        {clusters.map(([clusterName, items]) => {
          const confidence = items[0]?.cluster_confidence ?? null;
          const key = `${digestId}|${clusterName}`;
          const isOpen = !!expanded[key];
          const analysis = analyses.find((a) => a.cluster_name === clusterName);
          const myClusterVote = votes[`cluster:${digestId}|${clusterName}`];
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
                  {analysis && analysis.trend_streak >= 2 && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                      {analysis.trend_streak}. Woche
                    </span>
                  )}
                  {confidence && (
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[confidence]}`}
                    >
                      {CONFIDENCE_LABELS[confidence]}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                    {items.length}
                  </span>
                </button>
                <div className="shrink-0 flex items-center border-l border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => onVoteCluster(digestId, clusterName, "up")}
                    className={`px-2 py-2 transition-colors ${
                      myClusterVote === 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-[var(--color-muted)] hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                    title={myClusterVote === 1 ? "Upvote entfernen" : "Thema upvoten"}
                  >
                    <ArrowBigUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onVoteCluster(digestId, clusterName, "down")}
                    className={`px-2 py-2 transition-colors ${
                      myClusterVote === -1
                        ? "bg-red-100 text-red-700"
                        : "text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600"
                    }`}
                    title={myClusterVote === -1 ? "Downvote entfernen" : "Thema downvoten"}
                  >
                    <ArrowBigDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]">
                  {analysis ? (
                    <DeepAnalysisView analysis={analysis} items={items} onVote={onVote} votes={votes} />
                  ) : (
                    <>
                      {items[0]?.summary && (
                        <p className="text-sm text-[var(--color-fg)] mb-3 mt-2">{items[0].summary}</p>
                      )}
                      <ItemList items={items} onVote={onVote} votes={votes} />
                    </>
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

const CONFIDENCE_COLORS: Record<"verified" | "editorial" | "community", string> = {
  verified: "bg-emerald-600 text-white",
  editorial: "bg-blue-600 text-white",
  community: "bg-amber-500 text-white",
};

export function Dashboard() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [digests, setDigests] = useState<DigestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DigestFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Map<target_type:target_id, vote-value (-1 oder +1)>
  const [votes, setVotes] = useState<Record<string, -1 | 1>>({});
  const { session, signOut } = useAuth();

  function toggleCluster(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function voteKey(targetType: "item" | "cluster", targetId: string) {
    return `${targetType}:${targetId}`;
  }

  // Single-Vote Toggle-Logik:
  //   Aktuell kein Vote → setze direction
  //   Aktuell selbe direction → lösche (undo)
  //   Aktuell andere direction → flip auf direction
  async function castVote(targetType: "item" | "cluster", targetId: string, direction: "up" | "down") {
    if (!session?.user.id) return;
    const newValue: -1 | 1 = direction === "up" ? 1 : -1;
    const key = voteKey(targetType, targetId);
    const current = votes[key];

    if (current === newValue) {
      // Toggle off: delete vote
      setVotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await supabase
        .from("votes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId);
    } else {
      // Set or flip
      setVotes((prev) => ({ ...prev, [key]: newValue }));
      await supabase.from("votes").upsert(
        { user_id: session.user.id, target_type: targetType, target_id: targetId, value: newValue },
        { onConflict: "user_id,target_type,target_id" },
      );
    }
  }

  const voteItem = (itemId: string, direction: "up" | "down") =>
    castVote("item", itemId, direction);
  const voteCluster = (digestId: string, clusterName: string, direction: "up" | "down") =>
    castVote("cluster", `${digestId}|${clusterName}`, direction);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: companies } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (!companies || companies.length === 0) {
      setCompany(null);
      setAllCompanies([]);
      setLoading(false);
      navigate("/setup");
      return;
    }

    setAllCompanies(companies as Company[]);
    // Aktive Company: aktuell ausgewählte beibehalten falls noch in Liste, sonst neueste.
    const currentCompany = company && companies.some((c) => c.id === company.id)
      ? (companies.find((c) => c.id === company.id) as Company)
      : (companies[0] as Company);
    setCompany(currentCompany);

    const { data: digestData } = await supabase
      .from("digests")
      .select("*")
      .eq("company_id", currentCompany.id)
      .order("generated_at", { ascending: false });

    if (digestData) {
      const enriched = await Promise.all(
        digestData.map(async (d) => {
          const { data: items } = await supabase
            .from("digest_items")
            .select("*")
            .eq("digest_id", d.id);
          return { ...d, items: (items ?? []) as DigestItem[] } as DigestWithItems;
        }),
      );
      setDigests(enriched);

      await loadVotes();
    }

    setLoading(false);
  }

  async function loadVotes() {
    if (!session?.user.id) return;
    const { data: voteRows } = await supabase
      .from("votes")
      .select("target_type, target_id, value")
      .eq("user_id", session.user.id);
    const map: Record<string, -1 | 1> = {};
    for (const v of (voteRows ?? []) as Vote[]) {
      map[`${v.target_type}:${v.target_id}`] = v.value;
    }
    setVotes(map);
  }

  async function switchCompany(newCompany: Company) {
    setCompany(newCompany);
    setDigests([]);
    setLoading(true);
    const { data: digestData } = await supabase
      .from("digests")
      .select("*")
      .eq("company_id", newCompany.id)
      .order("generated_at", { ascending: false });
    if (digestData) {
      const enriched = await Promise.all(
        digestData.map(async (d) => {
          const { data: items } = await supabase
            .from("digest_items").select("*").eq("digest_id", d.id);
          return { ...d, items: (items ?? []) as DigestItem[] } as DigestWithItems;
        }),
      );
      setDigests(enriched);
      await loadVotes();
    }
    setLoading(false);
  }

  async function triggerRun() {
    if (!company) return;
    setTriggering(true);
    await supabase
      .from("jobs")
      .insert({ type: "niche_news_scrape", company_id: company.id });
    setTimeout(() => {
      setTriggering(false);
      loadData();
    }, 3000);
  }

  async function toggleFrequency() {
    if (!company) return;
    const next = company.scan_frequency === "daily" ? "weekly" : "daily";
    setCompany({ ...company, scan_frequency: next });
    setAllCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, scan_frequency: next } : c)));
    await supabase.from("companies").update({ scan_frequency: next }).eq("id", company.id);
  }

  async function saveKeywords(newKeywords: string[]) {
    if (!company) return;
    setCompany({ ...company, keywords: newKeywords });
    setAllCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, keywords: newKeywords } : c)));
    await supabase.from("companies").update({ keywords: newKeywords }).eq("id", company.id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Lade...</p>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  function groupByCluster(items: DigestItem[]) {
    const map: Record<string, DigestItem[]> = {};
    for (const item of items) {
      const key = item.cluster ?? "Sonstiges";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }

  const availableTypes = Array.from(new Set(digests.map((d) => d.type)));
  const showTabs = availableTypes.length > 1;

  const visibleDigests =
    activeFilter === "all"
      ? digests
      : digests.filter((d) => d.type === activeFilter);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-8 flex-wrap">
          <div className="min-w-0">
            {allCompanies.length > 1 ? (
              <select
                value={company.id}
                onChange={(e) => {
                  const selected = allCompanies.find((c) => c.id === e.target.value);
                  if (selected) switchCompany(selected);
                }}
                className="text-2xl font-semibold bg-transparent border-none -ml-1 pl-1 pr-7 py-0 cursor-pointer rounded hover:bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] truncate max-w-full"
              >
                {allCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.url ?? "Unbenannt"}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-2xl font-semibold">{company.name ?? company.url ?? "Unbenannt"}</h1>
            )}
            <p className="text-sm text-[var(--color-muted)] mt-1">
              {company.industry ?? "Keine Industrie gesetzt"}
              {company.niche && ` · ${company.niche}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <button
              type="button"
              onClick={toggleFrequency}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
                company.scan_frequency === "daily"
                  ? "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
                  : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
              }`}
              title={`Aktuell ${company.scan_frequency}. Klick zum Wechseln.`}
            >
              {company.scan_frequency === "daily" ? "🟠 Daily" : "🔵 Weekly"}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/setup")}>
              <Plus className="w-4 h-4 mr-1" />
              Neues Unternehmen
            </Button>
            <Button variant="secondary" size="sm" onClick={triggerRun} disabled={triggering}>
              <RefreshCw className={`w-4 h-4 mr-1 ${triggering ? "animate-spin" : ""}`} />
              {triggering ? "Triggered..." : "Run now"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <KeywordsEditor keywords={company.keywords} onSave={saveKeywords} />

        {digests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-sm text-[var(--color-fg)] mb-2">
                {company.industry
                  ? "Bot scraped Quellen und baut den ersten Digest. Dauert ein paar Minuten."
                  : "Bot analysiert deine Website, klassifiziert die Industrie und picked Sources."}
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-6">
                Setup von {formatDate(company.created_at)}. Aktualisiere die Seite in 1 bis 2 Minuten.
              </p>
              <Button variant="secondary" onClick={triggerRun} disabled={triggering}>
                <ArrowRight className="w-4 h-4 mr-1" />
                {triggering ? "Job läuft..." : "Manuell neu anstoßen"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filter-Tabs — erst sichtbar sobald mehrere Digest-Typen vorhanden */}
            {showTabs && (
              <div className="flex gap-2 mb-6 flex-wrap">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeFilter === "all"
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  Alle <span className="opacity-70">{digests.length}</span>
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === type
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    }`}
                  >
                    {TYPE_LABELS[type]}{" "}
                    <span className="opacity-70">
                      {digests.filter((d) => d.type === type).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Digest-Feed */}
            <div className="space-y-6">
              {visibleDigests.map((digest) => (
                <Card key={digest.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>{digest.title}</CardTitle>
                        <CardDescription>
                          Erzeugt {formatDate(digest.generated_at)}
                          {digest.delivered_at &&
                            ` · gesendet ${formatDate(digest.delivered_at)}`}
                        </CardDescription>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[digest.type]}`}
                      >
                        {TYPE_LABELS[digest.type]}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const grouped = groupByCluster(digest.items);
                      const fachmeinung: [string, DigestItem[]][] = [];
                      // T3-Items werden separat als Community-News gerendert, nicht in Clustern.
                      const communityItems: DigestItem[] = [];
                      for (const entry of Object.entries(grouped)) {
                        const confidence = entry[1][0]?.cluster_confidence;
                        if (confidence === "community") {
                          communityItems.push(...entry[1]);
                        } else {
                          fachmeinung.push(entry);
                        }
                      }
                      // Auch reine T3-Items aus anderen Clustern in die Community-Sektion ziehen.
                      for (const item of digest.items) {
                        if (item.source_tier === 3 && !communityItems.some((c) => c.id === item.id)) {
                          // Nur wenn nicht schon Teil eines Community-Clusters.
                          if (item.cluster_confidence !== "community") communityItems.push(item);
                        }
                      }
                      const analyses = digest.cluster_analyses ?? [];
                      return (
                        <>
                          {fachmeinung.length > 0 && (
                            <Section
                              title="Fachmeinung"
                              hint="Primärquellen und Industry-Pubs · faktische Synthese"
                              clusters={fachmeinung}
                              digestId={digest.id}
                              expanded={expanded}
                              toggle={toggleCluster}
                              analyses={analyses}
                              onVote={voteItem}
                              votes={votes}
                              onVoteCluster={voteCluster}
                            />
                          )}
                          {communityItems.length > 0 && (
                            <CommunitySection
                              items={communityItems}
                              digestId={digest.id}
                              expanded={expanded}
                              toggle={toggleCluster}
                              onVote={voteItem}
                              votes={votes}
                            />
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
