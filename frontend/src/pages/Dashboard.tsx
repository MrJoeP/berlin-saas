import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, RefreshCw, ChevronDown, ChevronRight, Plus, LogOut, Rss, ExternalLink } from "lucide-react";
import { NicheNewsDigest } from "@/features/niche-news/NicheNewsDigest";
import { TopPostDigest, type HookCluster } from "@/features/top-posts/TopPostDigest";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type Source,
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

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-amber-100 text-amber-800 border-amber-300",
};

function ToolBlock({
  title, week, color, live = true, children,
}: {
  title: string; week: string; color: string; live?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${color}`}>{week}</span>
        <h2 className={`text-sm font-semibold ${live ? "" : "text-[var(--color-muted)]"}`}>{title}</h2>
        {!live && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]">
            Kommt bald
          </span>
        )}
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      {children}
    </div>
  );
}

const TOP_POST_SOURCES: { name: string; type: string; tier: 1 | 2 | 3; note: string }[] = [
  { name: "Hacker News", type: "Algolia API", tier: 2, note: "score ≥ 50, nach Keywords gefiltert" },
  { name: "Product Hunt", type: "RSS", tier: 2, note: "neueste Launches, nach Keywords gefiltert" },
  { name: "LinkedIn (via Google)", type: "News RSS", tier: 2, note: "site:linkedin.com/posts + company + keywords" },
  { name: "Dev.to", type: "Tag-Feed", tier: 3, note: "erster Keyword-Tag als Slug" },
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
                ? `${items.length} Posts aus letztem Scrape · HN · Product Hunt · LinkedIn · Dev.to`
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

function ComingSoonBlock({
  title, week, color, description, sources, output,
}: {
  title: string; week: string; color: string; description: string;
  sources: string[]; output: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ToolBlock title={title} week={week} color={color} live={false}>
      <Card className="opacity-60">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
              Details
            </Button>
          </div>
        </CardHeader>
        {open && (
          <CardContent className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1.5">Quellen</div>
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li key={s} className="text-sm text-[var(--color-muted)] flex items-start gap-2">
                    <span className="mt-2 w-1 h-1 rounded-full bg-[var(--color-muted)] shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1.5">Output</div>
              <p className="text-sm text-[var(--color-muted)]">{output}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </ToolBlock>
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

function SourceManager({
  sources,
  onToggle,
  onAddRss,
}: {
  sources: CompanySourceRow[];
  onToggle: (sourceId: string, active: boolean) => Promise<void>;
  onAddRss: (name: string, url: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
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
            <CardTitle>Sources</CardTitle>
            <CardDescription>
              {activeCount} aktiv von {sources.length} Quellen
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
                Noch keine Quellen aktiv. Füge einen RSS-Feed hinzu oder starte den Company-Scrape erneut.
              </p>
            ) : (
              sorted.map((row) => {
                const source = row.sources;
                const tier = (source?.tier ?? 3) as 1 | 2 | 3;
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

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pitchMode = searchParams.get("pitch") === "1";
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [digests, setDigests] = useState<DigestWithItems[]>([]);
  const [sourceRows, setSourceRows] = useState<CompanySourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
      loadVotes(),
    ]);
    setLoading(false);
  }, [company?.id, loadDigestsForCompany, loadSources, loadVotes, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadData]);

  async function switchCompany(newCompany: Company) {
    setCompany(newCompany);
    setDigests([]);
    setSourceRows([]);
    setLoading(true);
    await Promise.all([
      loadDigestsForCompany(newCompany.id),
      loadSources(newCompany.id),
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
    });
    if (error) throw error;
    await loadSources(company.id);
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

  const topPostDigests = digests.filter((d) => d.type === "top_post");
  const nicheNewsDigests = digests.filter((d) => d.type === "niche_news");
  const latestTopPost = topPostDigests[0] ?? null;
  const latestNicheNews = nicheNewsDigests[0] ?? null;

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
          <TopPostDigest clusterAnalyses={(d.cluster_analyses ?? []) as unknown as HookCluster[]} />
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
              {triggering ? "Triggered..." : "Run now"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <KeywordsEditor keywords={company.keywords} onSave={saveKeywords} />

        {/* W2: Top-Post-Digest — pitchMode hides this to preserve the W1 storyline */}
        {!pitchMode && <ToolBlock title="Top-Post-Digest" week="W2" color="bg-emerald-600">
          <TopPostSourcePanel items={latestTopPost?.items ?? []} />
          {latestTopPost ? (
            <>
              {renderTopPost(latestTopPost)}
              <OlderDigests digests={topPostDigests.slice(1)} renderDigest={renderTopPost} />
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-[var(--color-muted)]">
                  Noch kein Top-Post-Digest. Läuft automatisch beim nächsten Cron-Job (täglich 06:30).
                </p>
              </CardContent>
            </Card>
          )}
        </ToolBlock>}

        {/* W1: Niche-News-Digest */}
        <ToolBlock title="Niche-News-Digest" week="W1" color="bg-[var(--color-accent)]">
          <SourceManager sources={sourceRows} onToggle={toggleSource} onAddRss={addRssSource} />
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
                  {triggering ? "Job läuft..." : "Manuell neu anstoßen"}
                </Button>
              </CardContent>
            </Card>
          )}
        </ToolBlock>

        {/* W3: Wettbewerbs-Monitor */}
        <ComingSoonBlock
          title="Wettbewerbs-Monitor"
          week="W3"
          color="bg-purple-600"
          description="Deep-Track auf benannte Konkurrenz, Sales-Page-Diffs und Messaging-Änderungen."
          sources={[
            "Website-Scrape via Firecrawl — Diff auf Pricing, Features, Messaging",
            "Google News RSS — Erwähnungen der Konkurrenten",
            "Product Hunt — neue Launches im selben Segment",
          ]}
          output="Wöchentlicher Diff: Was hat sich geändert, was ist neu, was wurde entfernt. Direkt vergleichbar mit eigenem Messaging."
        />

        {/* W4: UGC-Hunter */}
        <ComingSoonBlock
          title="UGC-Hunter"
          week="W4"
          color="bg-orange-500"
          description="Multi-Source-Mentions und Quote-Extraction aus Community-Posts und Reviews."
          sources={[
            "Reddit — Mentions in relevanten Subreddits via RSS",
            "Twitter / X — Keyword-Suche via nitter oder API",
            "G2 / Trustpilot — Review-Scrape für benannte Produkte",
            "Product Hunt — Kommentare und Reviews",
          ]}
          output="Quote-Library: Originalzitate nach Kategorie (Problem, Lob, Kritik, Wunsch). Direkt verwendbar in Marketing-Texten und Ads."
        />
      </div>
    </div>
  );
}
