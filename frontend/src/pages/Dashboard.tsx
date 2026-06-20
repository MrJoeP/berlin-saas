import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
} from "@/lib/supabase";
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

export function Dashboard() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [digests, setDigests] = useState<DigestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DigestFilter>("all");

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
                Noch kein Digest vorhanden.
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-1">
                Unternehmen angelegt {formatDate(company.created_at)}.
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-6">
                Voraussetzung: ANTHROPIC_API_KEY und RESEND_API_KEY müssen als Supabase Secrets gesetzt sein.
              </p>
              <Button onClick={triggerRun} disabled={triggering}>
                {triggering ? "Job läuft..." : "Ersten Run starten"}
                <ArrowRight className="w-4 h-4 ml-1" />
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
                    {Object.entries(groupByCluster(digest.items)).map(
                      ([cluster, items]) => (
                        <div key={cluster} className="mb-6 last:mb-0">
                          <h3 className="text-sm font-semibold mb-2">{cluster}</h3>
                          {items[0]?.summary && (
                            <p className="text-sm text-[var(--color-fg)] mb-3">
                              {items[0].summary}
                            </p>
                          )}
                          <ul className="space-y-1">
                            {items.map((item) => (
                              <li key={item.id}>
                                <a
                                  href={item.source_url ?? "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[var(--color-accent)] hover:underline"
                                >
                                  {item.title}
                                </a>
                                <span className="text-xs text-[var(--color-muted)] ml-2">
                                  {item.source_name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
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
