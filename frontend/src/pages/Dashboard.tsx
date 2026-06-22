import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, ChevronDown, ChevronRight, ArrowBigUp, ArrowBigDown, Plus } from "lucide-react";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type ClusterAnalysis,
  type ClusterVote,
} from "@/lib/supabase";
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

// Plattform-Mapping aus source_name. Für Community-News-Gruppierung.
function detectPlatform(sourceName: string | null): string {
  if (!sourceName) return "Andere";
  const s = sourceName.toLowerCase();
  if (s.startsWith("r/")) return "Reddit";
  if (s.includes("hacker news") || s.startsWith("hn ")) return "Hacker News";
  if (s.includes("product hunt") || s === "producthunt") return "Product Hunt";
  if (s.includes("twitter") || s.includes("x.com") || s === "x") return "Twitter/X";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("linkedin")) return "LinkedIn";
  return sourceName;
}

function ItemRow({ item, onVote }: { item: DigestItem; onVote: (id: string, dir: "up" | "down") => void }) {
  const tier = (item.source_tier ?? 3) as 1 | 2 | 3;
  const score = (item.upvotes ?? 0) - (item.downvotes ?? 0);
  return (
    <li className="flex items-start gap-2 group">
      <div className="shrink-0 mt-0.5 flex flex-col items-center justify-center w-7">
        <button
          type="button"
          onClick={() => onVote(item.id, "up")}
          className="p-0.5 rounded hover:bg-emerald-50 transition-colors text-[var(--color-muted)] hover:text-emerald-600"
          title="Upvote"
        >
          <ArrowBigUp className="w-4 h-4" />
        </button>
        <span
          className={`text-[10px] font-medium tabular-nums leading-tight ${
            score > 0 ? "text-emerald-600" : score < 0 ? "text-red-600" : "text-[var(--color-muted)]"
          }`}
        >
          {score > 0 ? `+${score}` : score}
        </span>
        <button
          type="button"
          onClick={() => onVote(item.id, "down")}
          className="p-0.5 rounded hover:bg-red-50 transition-colors text-[var(--color-muted)] hover:text-red-600"
          title="Downvote"
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

function ItemList({ items, onVote }: { items: DigestItem[]; onVote: (id: string, dir: "up" | "down") => void }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => <ItemRow key={item.id} item={item} onVote={onVote} />)}
    </ul>
  );
}

function DeepAnalysisView({ analysis, items, onVote }: { analysis: ClusterAnalysis; items: DigestItem[]; onVote: (id: string, dir: "up" | "down") => void }) {
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
          <ItemList items={items} onVote={onVote} />
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
}: {
  items: DigestItem[];
  digestId: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  onVote: (id: string, dir: "up" | "down") => void;
}) {
  const byPlatform: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const platform = detectPlatform(item.source_name);
    if (!byPlatform[platform]) byPlatform[platform] = [];
    byPlatform[platform].push(item);
  }
  // Sort: höchstes Upvote-Total zuerst, dann nach Item-Anzahl.
  const entries = Object.entries(byPlatform).sort((a, b) => {
    const upA = a[1].reduce((s, i) => s + (i.upvotes ?? 0), 0);
    const upB = b[1].reduce((s, i) => s + (i.upvotes ?? 0), 0);
    if (upA !== upB) return upB - upA;
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
          const upvoteTotal = platformItems.reduce((s, i) => s + (i.upvotes ?? 0), 0);
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
                {upvoteTotal > 0 && (
                  <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                    ▲ {upvoteTotal}
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
                      const sa = (a.upvotes ?? 0) - (a.downvotes ?? 0);
                      const sb = (b.upvotes ?? 0) - (b.downvotes ?? 0);
                      return sb - sa;
                    })}
                    onVote={onVote}
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
  clusterVotes,
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
  clusterVotes: Record<string, ClusterVote>;
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
          const cv = clusterVotes[key];
          const clusterScore = (cv?.upvotes ?? 0) - (cv?.downvotes ?? 0);
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
                    className="px-2 py-2 hover:bg-emerald-50 transition-colors text-[var(--color-muted)] hover:text-emerald-600"
                    title="Thema upvoten"
                  >
                    <ArrowBigUp className="w-4 h-4" />
                  </button>
                  <span
                    className={`px-1 text-xs font-medium tabular-nums w-7 text-center ${
                      clusterScore > 0
                        ? "text-emerald-600"
                        : clusterScore < 0
                          ? "text-red-600"
                          : "text-[var(--color-muted)]"
                    }`}
                  >
                    {clusterScore > 0 ? `+${clusterScore}` : clusterScore}
                  </span>
                  <button
                    type="button"
                    onClick={() => onVoteCluster(digestId, clusterName, "down")}
                    className="px-2 py-2 hover:bg-red-50 transition-colors text-[var(--color-muted)] hover:text-red-600"
                    title="Thema downvoten"
                  >
                    <ArrowBigDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]">
                  {analysis ? (
                    <DeepAnalysisView analysis={analysis} items={items} onVote={onVote} />
                  ) : (
                    <>
                      {items[0]?.summary && (
                        <p className="text-sm text-[var(--color-fg)] mb-3 mt-2">{items[0].summary}</p>
                      )}
                      <ItemList items={items} onVote={onVote} />
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
  const [clusterVotes, setClusterVotes] = useState<Record<string, ClusterVote>>({});

  function toggleCluster(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function clusterKey(digestId: string, clusterName: string) {
    return `${digestId}|${clusterName}`;
  }

  async function voteItem(itemId: string, direction: "up" | "down") {
    const field = direction === "up" ? "upvotes" : "downvotes";
    // Optimistic UI Update.
    let nextValue = 0;
    setDigests((prev) =>
      prev.map((d) => ({
        ...d,
        items: d.items.map((it) => {
          if (it.id !== itemId) return it;
          nextValue = (it[field] ?? 0) + 1;
          return { ...it, [field]: nextValue };
        }),
      })),
    );
    await supabase.from("digest_items").update({ [field]: nextValue }).eq("id", itemId);
  }

  async function voteCluster(digestId: string, clusterName: string, direction: "up" | "down") {
    const key = clusterKey(digestId, clusterName);
    const current = clusterVotes[key] ?? { digest_id: digestId, cluster_name: clusterName, upvotes: 0, downvotes: 0 };
    const field = direction === "up" ? "upvotes" : "downvotes";
    const next = { ...current, [field]: current[field] + 1 };
    // Optimistic UI Update.
    setClusterVotes((prev) => ({ ...prev, [key]: next }));
    // Upsert in DB.
    await supabase.from("digest_cluster_votes").upsert(
      {
        digest_id: digestId,
        cluster_name: clusterName,
        upvotes: next.upvotes,
        downvotes: next.downvotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "digest_id,cluster_name" },
    );
  }

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

      // Cluster-Votes für alle Digests bulk laden.
      const digestIds = enriched.map((d) => d.id);
      if (digestIds.length > 0) {
        const { data: votes } = await supabase
          .from("digest_cluster_votes")
          .select("*")
          .in("digest_id", digestIds);
        const map: Record<string, ClusterVote> = {};
        for (const v of (votes ?? []) as ClusterVote[]) {
          map[`${v.digest_id}|${v.cluster_name}`] = v;
        }
        setClusterVotes(map);
      }
    }

    setLoading(false);
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
      const digestIds = enriched.map((d) => d.id);
      if (digestIds.length > 0) {
        const { data: votes } = await supabase
          .from("digest_cluster_votes").select("*").in("digest_id", digestIds);
        const map: Record<string, ClusterVote> = {};
        for (const v of (votes ?? []) as ClusterVote[]) {
          map[`${v.digest_id}|${v.cluster_name}`] = v;
        }
        setClusterVotes(map);
      } else {
        setClusterVotes({});
      }
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
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-2xl font-semibold">{company.name}</h1>
            )}
            <p className="text-sm text-[var(--color-muted)] mt-1">
              {company.industry ?? "Keine Industrie gesetzt"}
              {company.niche && ` · ${company.niche}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/setup")}>
              <Plus className="w-4 h-4 mr-1" />
              Neues Unternehmen
            </Button>
            <Button variant="secondary" size="sm" onClick={triggerRun} disabled={triggering}>
              <RefreshCw className={`w-4 h-4 mr-1 ${triggering ? "animate-spin" : ""}`} />
              {triggering ? "Triggered..." : "Run now"}
            </Button>
          </div>
        </div>

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
                              clusterVotes={clusterVotes}
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
