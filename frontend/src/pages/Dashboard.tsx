import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, ChevronDown, ChevronRight, Plus, LogOut, Rss, ExternalLink } from "lucide-react";
import { NicheNewsDigest } from "@/features/niche-news/NicheNewsDigest";
import { TopPostDigest, type PublishedContentCluster } from "@/features/top-posts/TopPostDigest";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type Job,
  type Source,
  type SourceHealth,
  type Vote,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";

interface DigestWithItems extends Digest {
  items: DigestItem[];
}

interface CompanySourceRow {
  company_id: string;
  source_id: string;
  active: boolean;
  sources: Source | null;
}

type CompanyContextDraft = {
  product_description: string;
  icp: string;
  target_market: string;
  keywords: string;
  negative_keywords: string;
};

const TYPE_LABELS: Record<Digest["type"], string> = {
  niche_news: "Niche News",
  top_post: "Published Content",
  competitor: "Wettbewerb",
  ugc: "UGC",
};

const TYPE_COLORS: Record<Digest["type"], string> = {
  niche_news: "bg-[var(--color-accent)] text-white",
  top_post: "bg-emerald-600 text-white",
  competitor: "bg-purple-600 text-white",
  ugc: "bg-orange-500 text-white",
};

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-amber-100 text-amber-800 border-amber-300",
};


const TOP_POST_SOURCES: { name: string; type: string; tier: 1 | 2 | 3; note: string }[] = [
  { name: "Hacker News", type: "Algolia API", tier: 2, note: "score ≥ 50, nach Keywords gefiltert" },
  { name: "Product Hunt", type: "RSS", tier: 2, note: "neueste Launches, nach Keywords gefiltert" },
  { name: "Reddit", type: "Search API", tier: 3, note: "veröffentlichte Beiträge der Woche, echte Upvote-Scores" },
  { name: "Twitter/X", type: "Nitter RSS", tier: 2, note: "min. 100 Likes, kein Retweet" },
  { name: "LinkedIn (via Google)", type: "News RSS", tier: 2, note: "site:linkedin.com/posts + Keywords" },
  { name: "Dev.to", type: "API", tier: 3, note: "Top Artikel nach Keyword-Tag, Reactions-Score" },
];

function TopPostSourcePanel({ items }: { items: DigestItem[] }) {
  const [open, setOpen] = useState(false);
  const countBySource = items.reduce<Record<string, number>>((acc, i) => {
    const k = i.source_name ?? "Andere";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Quellen</CardTitle>
            <CardDescription>
              {items.length > 0
                ? `${items.length} veröffentlichte Inhalte aus letztem Scrape · HN · Product Hunt · LinkedIn · Dev.to`
                : "HN · Product Hunt · LinkedIn (via Google) · Dev.to"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            Quellen
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-2">
            {TOP_POST_SOURCES.map((src) => (
              <div key={src.name} className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{src.name}</span>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${TIER_COLORS[src.tier]}`}>
                      T{src.tier}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-muted)] uppercase">{src.type}</span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{src.note}</p>
                </div>
                {items.length > 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {countBySource[src.name] ?? 0} Posts
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-muted)] mt-3">
            Festgelegte Quellen — kein Toggle. Keywords im Profil steuern den Filter.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function OlderDigests({
  digests: older, renderDigest,
}: {
  digests: DigestWithItems[];
  renderDigest: (d: DigestWithItems) => React.ReactNode;
}) {
  if (older.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] select-none px-1 py-1">
        {older.length} {older.length === 1 ? "älterer Digest" : "ältere Digests"}
      </summary>
      <div className="mt-2 space-y-2">{older.map(renderDigest)}</div>
    </details>
  );
}

function KeywordsEditor({
  company,
  onSave,
}: {
  company: Company;
  onSave: (next: {
    product_description: string | null;
    icp: string | null;
    target_market: string | null;
    keywords: string[];
    negative_keywords: string[];
  }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyContextDraft>(() => contextDraftFromCompany(company));

  function start() {
    setDraft(contextDraftFromCompany(company));
    setEditing(true);
  }

  async function commit() {
    await onSave({
      product_description: emptyToNull(draft.product_description),
      icp: emptyToNull(draft.icp),
      target_market: emptyToNull(draft.target_market),
      keywords: parseCommaList(draft.keywords),
      negative_keywords: parseCommaList(draft.negative_keywords),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mb-6 p-3 border border-[var(--color-accent)] rounded-md bg-[var(--color-bg)]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-2">
          Company Context
        </div>
        <div className="grid gap-2">
          <textarea
            value={draft.product_description}
            onChange={(e) => setDraft((prev) => ({ ...prev, product_description: e.target.value }))}
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={2}
            placeholder="Produkt in einem Satz"
            autoFocus
          />
          <textarea
            value={draft.icp}
            onChange={(e) => setDraft((prev) => ({ ...prev, icp: e.target.value }))}
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={2}
            placeholder="ICP / Zielkunden"
          />
          <input
            value={draft.target_market}
            onChange={(e) => setDraft((prev) => ({ ...prev, target_market: e.target.value }))}
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            placeholder="Zielmarkt, z.B. DACH, EU B2B SaaS, English-speaking founders"
          />
          <textarea
            value={draft.keywords}
            onChange={(e) => setDraft((prev) => ({ ...prev, keywords: e.target.value }))}
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={2}
            placeholder="Relevante Keywords, komma-getrennt"
          />
          <textarea
            value={draft.negative_keywords}
            onChange={(e) => setDraft((prev) => ({ ...prev, negative_keywords: e.target.value }))}
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={2}
            placeholder="Irrelevante Begriffe, komma-getrennt"
          />
        </div>
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
          Wirkt ab dem nächsten Founder Briefing. Negative Keywords filtern Rauschen vor der Analyse.
        </p>
      </div>
    );
  }

  const keywords = company.keywords ?? [];
  const negative = company.negative_keywords ?? [];
  return (
    <div className="mb-6 rounded-md border border-[var(--color-border)] p-3 bg-white">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-1">
            Company Context
          </div>
          <p className="text-sm text-[var(--color-fg)]">
            {company.product_description || "Noch keine Produktbeschreibung gesetzt."}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {company.icp || "ICP fehlt"}{company.target_market ? ` · ${company.target_market}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {keywords.map((k) => (
              <span key={k} className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)]">
                {k}
              </span>
            ))}
            {negative.map((k) => (
              <span key={k} className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                -{k}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
        >
          Bearbeiten
        </button>
      </div>
    </div>
  );
}

function contextDraftFromCompany(company: Company): CompanyContextDraft {
  return {
    product_description: company.product_description ?? "",
    icp: company.icp ?? "",
    target_market: company.target_market ?? "",
    keywords: (company.keywords ?? []).join(", "),
    negative_keywords: (company.negative_keywords ?? []).join(", "),
  };
}

function parseCommaList(value: string): string[] {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function SourceManager({
  sources,
  health,
  onToggle,
  onAddRss,
  title = "Sources",
  description,
  emptyHint = "Noch keine Quellen aktiv. Füge einen RSS-Feed hinzu oder starte den Company-Scrape erneut.",
}: {
  sources: CompanySourceRow[];
  health: Record<string, SourceHealth>;
  onToggle: (sourceId: string, active: boolean) => Promise<void>;
  onAddRss: (name: string, url: string) => Promise<void>;
  title?: string;
  description?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = sources.filter((row) => row.active).length;
  const sorted = [...sources].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const tierA = a.sources?.tier ?? 3;
    const tierB = b.sources?.tier ?? 3;
    if (tierA !== tierB) return tierA - tierB;
    return (a.sources?.name ?? "").localeCompare(b.sources?.name ?? "");
  });

  async function submitRss() {
    setSaving(true);
    setError(null);
    try {
      await onAddRss(name, rssUrl);
      setName("");
      setRssUrl("");
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {description ?? `${activeCount} aktiv von ${sources.length} Quellen`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            Quellen
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-2 mb-4">
            {sorted.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                {emptyHint}
              </p>
            ) : (
              sorted.map((row) => {
                const source = row.sources;
                const tier = (source?.tier ?? 3) as 1 | 2 | 3;
                const sourceHealth = health[row.source_id];
                const acceptedRate = sourceHealth && sourceHealth.items_fetched > 0
                  ? Math.round((sourceHealth.items_accepted / sourceHealth.items_fetched) * 100)
                  : null;
                return (
                  <div
                    key={row.source_id}
                    className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        onToggle(row.source_id, !row.active).catch((err) => {
                          setError(err instanceof Error ? err.message : String(err));
                        });
                      }}
                      className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                        row.active ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                      }`}
                      title={row.active ? "Quelle deaktivieren" : "Quelle aktivieren"}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                          row.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {source?.name ?? row.source_id}
                        </span>
                        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${TIER_COLORS[tier]}`}>
                          T{tier}
                        </span>
                        {source?.type && (
                          <span className="shrink-0 text-[10px] text-[var(--color-muted)] uppercase">
                            {source.type}
                          </span>
                        )}
                      </div>
                      {source?.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          <span className="truncate">{source.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                      {sourceHealth && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[var(--color-muted)]">
                          <span>
                            {sourceHealth.last_error ? "Fehler" : "OK"}
                          </span>
                          <span>· {sourceHealth.items_accepted}/{sourceHealth.items_fetched} akzeptiert</span>
                          {acceptedRate !== null && <span>· {acceptedRate}% Trefferquote</span>}
                          {sourceHealth.last_error && <span className="text-red-700">· {sourceHealth.last_error}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Rss className="w-4 h-4 text-[var(--color-muted)]" />
              <span className="text-xs font-bold uppercase tracking-wider">RSS hinzufügen</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Name"
              />
              <input
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="https://example.com/feed.xml"
                type="url"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={submitRss}
                disabled={saving || !name.trim() || !rssUrl.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                {saving ? "Speichere..." : "Hinzufügen"}
              </Button>
            </div>
            {error && <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function JobStatusPanel({ jobs }: { jobs: Job[] }) {
  const active = jobs.find((job) => job.status === "running" || job.status === "pending");
  const latest = active ?? jobs[0] ?? null;
  if (!latest) return null;

  const label = latest.status === "running"
    ? "Läuft"
    : latest.status === "pending"
    ? "In Queue"
    : latest.status === "completed"
    ? "Fertig"
    : "Fehler";
  const tone = latest.status === "failed"
    ? "bg-red-50 text-red-800 border-red-200"
    : latest.status === "completed"
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-blue-50 text-blue-800 border-blue-200";

  return (
    <div className={`mb-4 rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold">
            Founder Briefing: {label}
          </div>
          <p className="text-xs opacity-80 mt-0.5">
            {latest.type}
            {latest.started_at ? ` · gestartet ${formatDate(latest.started_at)}` : ` · erstellt ${formatDate(latest.created_at)}`}
          </p>
          {latest.error && <p className="text-xs mt-1">{latest.error}</p>}
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-current opacity-80">
          {latest.retry_count}/{latest.max_retries}
        </span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [digests, setDigests] = useState<DigestWithItems[]>([]);
  const [sourceRows, setSourceRows] = useState<CompanySourceRow[]>([]);
  const [sourceHealth, setSourceHealth] = useState<Record<string, SourceHealth>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedTool, setSelectedTool] = useState<"niche_news" | "top_post">("niche_news");
  // Map<target_type:target_id, vote-value (-1 oder +1)>
  const [votes, setVotes] = useState<Record<string, -1 | 1>>({});
  const { session, signOut } = useAuth();
  const userId = session?.user.id;

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
    if (!userId) return;
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
        .eq("user_id", userId)
        .eq("target_type", targetType)
        .eq("target_id", targetId);
    } else {
      // Set or flip
      setVotes((prev) => ({ ...prev, [key]: newValue }));
      await supabase.from("votes").upsert(
        { user_id: userId, target_type: targetType, target_id: targetId, value: newValue },
        { onConflict: "user_id,target_type,target_id" },
      );
    }
  }

  const voteItem = (itemId: string, direction: "up" | "down") =>
    castVote("item", itemId, direction);
  const voteCluster = (digestId: string, clusterName: string, direction: "up" | "down") =>
    castVote("cluster", `${digestId}|${clusterName}`, direction);

  const loadVotes = useCallback(async () => {
    if (!userId) return;
    const { data: voteRows } = await supabase
      .from("votes")
      .select("target_type, target_id, value")
      .eq("user_id", userId);
    const map: Record<string, -1 | 1> = {};
    for (const v of (voteRows ?? []) as Vote[]) {
      map[`${v.target_type}:${v.target_id}`] = v.value;
    }
    setVotes(map);
  }, [userId]);

  const loadSources = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from("company_sources")
      .select("company_id, source_id, active, sources(*)")
      .eq("company_id", companyId);
    setSourceRows((data ?? []) as unknown as CompanySourceRow[]);
  }, []);

  const loadSourceHealth = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from("source_health")
      .select("*")
      .eq("company_id", companyId);
    const map: Record<string, SourceHealth> = {};
    for (const row of (data ?? []) as SourceHealth[]) map[row.source_id] = row;
    setSourceHealth(map);
  }, []);

  const loadJobs = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8);
    setJobs((data ?? []) as Job[]);
  }, []);

  const loadDigestsForCompany = useCallback(async (companyId: string) => {
    const { data: digestData } = await supabase
      .from("digests")
      .select("*")
      .eq("company_id", companyId)
      .order("generated_at", { ascending: false });

    if (!digestData) {
      setDigests([]);
      return;
    }

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
  }, []);

  const loadData = useCallback(async () => {
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
    const selectedCompanyId = company?.id;
    const currentCompany = selectedCompanyId && companies.some((c) => c.id === selectedCompanyId)
      ? (companies.find((c) => c.id === selectedCompanyId) as Company)
      : (companies[0] as Company);
    setCompany(currentCompany);
    await Promise.all([
      loadDigestsForCompany(currentCompany.id),
      loadSources(currentCompany.id),
      loadSourceHealth(currentCompany.id),
      loadJobs(currentCompany.id),
      loadVotes(),
    ]);
    setLoading(false);
  }, [company?.id, loadDigestsForCompany, loadJobs, loadSourceHealth, loadSources, loadVotes, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadData]);

  useEffect(() => {
    if (!company || !jobs.some((job) => job.status === "pending" || job.status === "running")) return;
    const id = window.setInterval(() => {
      void Promise.all([
        loadJobs(company.id),
        loadDigestsForCompany(company.id),
        loadSourceHealth(company.id),
      ]);
    }, 2500);
    return () => window.clearInterval(id);
  }, [company, jobs, loadDigestsForCompany, loadJobs, loadSourceHealth]);

  async function switchCompany(newCompany: Company) {
    setCompany(newCompany);
    setDigests([]);
    setSourceRows([]);
    setSourceHealth({});
    setJobs([]);
    setLoading(true);
    await Promise.all([
      loadDigestsForCompany(newCompany.id),
      loadSources(newCompany.id),
      loadSourceHealth(newCompany.id),
      loadJobs(newCompany.id),
      loadVotes(),
    ]);
    setLoading(false);
  }

  async function toggleSource(sourceId: string, active: boolean) {
    if (!company) return;
    setSourceRows((prev) =>
      prev.map((row) => (row.source_id === sourceId ? { ...row, active } : row)),
    );
    const { error } = await supabase
      .from("company_sources")
      .update({ active })
      .eq("company_id", company.id)
      .eq("source_id", sourceId);
    if (error) {
      setSourceRows((prev) =>
        prev.map((row) => (row.source_id === sourceId ? { ...row, active: !active } : row)),
      );
      throw error;
    }
  }

  async function addRssSource(name: string, rssUrl: string) {
    if (!company) return;
    const { error } = await supabase.rpc("add_company_rss_source", {
      p_company_id: company.id,
      p_name: name,
      p_url: rssUrl,
      p_feed_scope: "niche_news",
    });
    if (error) throw error;
    await Promise.all([loadSources(company.id), loadSourceHealth(company.id)]);
  }

  async function addTopPostRssSource(name: string, rssUrl: string) {
    if (!company) return;
    const { error } = await supabase.rpc("add_company_rss_source", {
      p_company_id: company.id,
      p_name: name,
      p_url: rssUrl,
      p_feed_scope: "top_post",
    });
    if (error) throw error;
    await Promise.all([loadSources(company.id), loadSourceHealth(company.id)]);
  }

  async function triggerRun() {
    if (!company) return;
    setTriggering(true);
    const { data, error } = await supabase
      .from("jobs")
      .insert({ type: "niche_news_scrape", company_id: company.id })
      .select()
      .single();
    if (!error && data) setJobs((prev) => [data as Job, ...prev]);
    setTriggering(false);
    await loadJobs(company.id);
  }

  async function triggerTopPost() {
    if (!company) return;
    setTriggering(true);
    const { data, error } = await supabase
      .from("jobs")
      .insert({ type: "top_post_scrape", company_id: company.id })
      .select()
      .single();
    if (!error && data) setJobs((prev) => [data as Job, ...prev]);
    setTriggering(false);
    await loadJobs(company.id);
  }

  async function toggleFrequency() {
    if (!company) return;
    const next = company.scan_frequency === "daily" ? "weekly" : "daily";
    setCompany({ ...company, scan_frequency: next });
    setAllCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, scan_frequency: next } : c)));
    await supabase.from("companies").update({ scan_frequency: next }).eq("id", company.id);
  }

  async function saveCompanyContext(next: {
    product_description: string | null;
    icp: string | null;
    target_market: string | null;
    keywords: string[];
    negative_keywords: string[];
  }) {
    if (!company) return;
    setCompany({ ...company, ...next });
    setAllCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, ...next } : c)));
    await supabase.from("companies").update(next).eq("id", company.id);
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

  const topPostDigests = digests.filter((d) => d.type === "top_post");
  const nicheNewsDigests = digests.filter((d) => d.type === "niche_news");
  const latestTopPost = topPostDigests[0] ?? null;
  const latestNicheNews = nicheNewsDigests[0] ?? null;

  const feedScopeOf = (row: CompanySourceRow): string =>
    (row.sources?.config?.feed_scope as string | undefined) ?? "niche_news";
  const nicheSourceRows = sourceRows.filter((row) => feedScopeOf(row) !== "top_post");
  const topPostSourceRows = sourceRows.filter((row) => feedScopeOf(row) === "top_post");

  function renderTopPost(d: DigestWithItems) {
    return (
      <Card key={d.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{d.title}</CardTitle>
              <CardDescription>Erzeugt {formatDate(d.generated_at)}</CardDescription>
            </div>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS["top_post"]}`}>
              {TYPE_LABELS["top_post"]}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <TopPostDigest
            clusterAnalyses={(d.cluster_analyses ?? []) as unknown as PublishedContentCluster[]}
            items={d.items}
            onVote={voteItem}
            votes={votes}
          />
        </CardContent>
      </Card>
    );
  }

  function renderNicheNews(d: DigestWithItems) {
    return (
      <Card key={d.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{d.title}</CardTitle>
              <CardDescription>
                Erzeugt {formatDate(d.generated_at)}
                {d.delivered_at && ` · gesendet ${formatDate(d.delivered_at)}`}
              </CardDescription>
            </div>
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS["niche_news"]}`}>
              {TYPE_LABELS["niche_news"]}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <NicheNewsDigest
            items={d.items}
            digestId={d.id}
            analyses={d.cluster_analyses ?? []}
            expanded={expanded}
            toggle={toggleCluster}
            onVote={voteItem}
            votes={votes}
            onVoteCluster={voteCluster}
          />
        </CardContent>
      </Card>
    );
  }

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
              {triggering ? "Queued..." : "Generate Briefing"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <KeywordsEditor company={company} onSave={saveCompanyContext} />

        {/* Tool-Auswahl */}
        <div className="flex gap-0 mb-6 border-b border-[var(--color-border)]">
          {(["niche_news", "top_post"] as const).map((tool) => {
            const label = tool === "niche_news" ? "Niche News" : "Published Content";
            const active = selectedTool === tool;
            return (
              <button
                key={tool}
                type="button"
                onClick={() => setSelectedTool(tool)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                    : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Niche News */}
        {selectedTool === "niche_news" && (
          <div>
            <JobStatusPanel jobs={jobs} />
            <SourceManager sources={nicheSourceRows} health={sourceHealth} onToggle={toggleSource} onAddRss={addRssSource} />
            {latestNicheNews ? (
              <>
                {renderNicheNews(latestNicheNews)}
                <OlderDigests digests={nicheNewsDigests.slice(1)} renderDigest={renderNicheNews} />
              </>
            ) : (
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
                    {triggering ? "Queue..." : "Founder Briefing generieren"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Published Content */}
        {selectedTool === "top_post" && (
          <div>
            <TopPostSourcePanel items={latestTopPost?.items ?? []} />
            <SourceManager
              sources={topPostSourceRows}
              health={sourceHealth}
              onToggle={toggleSource}
              onAddRss={addTopPostRssSource}
              title="Eigene Quellen"
              description="Eigene RSS-Feeds zusätzlich zu den festen Published-Content-Quellen"
              emptyHint="Noch keine eigenen Quellen. Füge unten einen RSS-Feed hinzu, der nur in Published Content einfließt."
            />
            {latestTopPost ? (
              <>
                {renderTopPost(latestTopPost)}
                <OlderDigests digests={topPostDigests.slice(1)} renderDigest={renderTopPost} />
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-sm text-[var(--color-fg)] mb-2">
                    Noch kein Published-Content-Briefing. Sammelt veröffentlichte Artikel, Beiträge und Launches der letzten 7 Tage.
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mb-6">
                    Dauert ca. 1–2 Minuten.
                  </p>
                  <Button variant="secondary" onClick={triggerTopPost} disabled={triggering}>
                    <ArrowRight className="w-4 h-4 mr-1" />
                    {triggering ? "Queue..." : "Veröffentlichungen sammeln"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
