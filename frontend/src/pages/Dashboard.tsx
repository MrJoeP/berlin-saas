import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type ClusterAnalysis,
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

function ItemList({ items }: { items: DigestItem[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const tier = (item.source_tier ?? 3) as 1 | 2 | 3;
        return (
          <li key={item.id} className="flex items-start gap-2">
            <span
              className={`shrink-0 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${TIER_COLORS[tier]}`}
              title={TIER_LABELS[tier]}
            >
              T{tier}
            </span>
            <div className="flex-1 min-w-0">
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
      })}
    </ul>
  );
}

function DeepAnalysisView({ analysis, items }: { analysis: ClusterAnalysis; items: DigestItem[] }) {
  return (
    <div className="pt-3 space-y-4">
      <Block label="Was passiert ist" body={analysis.was_passiert} />
      <Block label={`Warum für deine Nische relevant`} body={analysis.warum_relevant} highlight />
      {analysis.industry_uneins && (
        <Block label="Wo die Industry uneins ist" body={analysis.industry_uneins} />
      )}
      {analysis.action_woche?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1.5">
            Diese Woche
          </div>
          <ul className="space-y-1">
            {analysis.action_woche.map((step, idx) => (
              <li key={idx} className="text-sm text-[var(--color-fg)] flex gap-2">
                <span className="text-[var(--color-muted)] shrink-0">{idx + 1}.</span>
                <span>{step}</span>
              </li>
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
      <details className="pt-2 border-t border-[var(--color-border)]">
        <summary className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg)]">
          Alle Quellen ({items.length})
        </summary>
        <div className="mt-2">
          <ItemList items={items} />
        </div>
      </details>
    </div>
  );
}

function Block({ label, body, highlight = false }: { label: string; body: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg)] mb-1">
        {label}
      </div>
      <p
        className={`text-sm leading-relaxed ${
          highlight
            ? "text-[var(--color-fg)] bg-amber-50 px-3 py-2 rounded border-l-2 border-amber-400"
            : "text-[var(--color-fg)]"
        }`}
      >
        {body}
      </p>
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
  dimmed = false,
}: {
  title: string;
  hint: string;
  clusters: [string, DigestItem[]][];
  digestId: string;
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
  analyses: ClusterAnalysis[];
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
          return (
            <div key={clusterName} className="border border-[var(--color-border)] rounded-md overflow-hidden">
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
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]">
                  {analysis ? (
                    <DeepAnalysisView analysis={analysis} items={items} />
                  ) : (
                    <>
                      {items[0]?.summary && (
                        <p className="text-sm text-[var(--color-fg)] mb-3 mt-2">{items[0].summary}</p>
                      )}
                      <ItemList items={items} />
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
  const [digests, setDigests] = useState<DigestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DigestFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleCluster(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: companies } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!companies || companies.length === 0) {
      setCompany(null);
      setLoading(false);
      navigate("/setup");
      return;
    }

    const currentCompany = companies[0] as Company;
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {company.industry ?? "Keine Industrie gesetzt"}
              {company.niche && ` · ${company.niche}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={triggerRun} disabled={triggering}>
            <RefreshCw className={`w-4 h-4 mr-1 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Triggered..." : "Run now"}
          </Button>
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
                      const stimmungsbild: [string, DigestItem[]][] = [];
                      for (const entry of Object.entries(grouped)) {
                        const confidence = entry[1][0]?.cluster_confidence;
                        if (confidence === "community") stimmungsbild.push(entry);
                        else fachmeinung.push(entry);
                      }
                      const analyses = digest.cluster_analyses ?? [];
                      return (
                        <>
                          {fachmeinung.length > 0 && (
                            <Section
                              title="Fachmeinung"
                              hint="Primärquellen und Industry-Pubs"
                              clusters={fachmeinung}
                              digestId={digest.id}
                              expanded={expanded}
                              toggle={toggleCluster}
                              analyses={analyses}
                            />
                          )}
                          {stimmungsbild.length > 0 && (
                            <Section
                              title="Stimmungsbild"
                              hint="Community-Diskussionen, ungeprüft"
                              clusters={stimmungsbild}
                              digestId={digest.id}
                              expanded={expanded}
                              toggle={toggleCluster}
                              analyses={analyses}
                              dimmed
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
