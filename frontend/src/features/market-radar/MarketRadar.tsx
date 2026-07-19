import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pin,
  Plus,
  Radar,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  supabase,
  type Company,
  type Digest,
  type DigestItem,
  type RadarEntity,
} from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { DEMO_ENTITIES, DEMO_SIGNALS, type EntityType } from "./mockData";

// Woche 3: Market Radar. Registry echter Entitäten (Supabase), Radar-Digest aus
// digests.type='competitor' (Worker-Pipeline radar_snapshot -> radar_signals ->
// radar_digest). Fällt auf Demo-Daten zurück, solange die Migration 036 nicht
// angewendet ist oder keine Company übergeben wird (Dev-Preview).

interface DigestWithItems extends Digest {
  items: DigestItem[];
}

interface RadarDigestSignal {
  signal_id: string;
  entity_name: string;
  signal_type: string;
  title: string;
  what_happened: string;
  why_it_matters: string;
  next_step: string;
  source_url: string | null;
  source_name: string | null;
  detected_at: string;
  severity: number;
  score: number;
  drift_flag: boolean;
  pinned: boolean;
  diff: { removed: string[]; added: string[] } | null;
}

interface RadarDigestCluster {
  lens: EntityType;
  signals: RadarDigestSignal[];
}

export interface MarketRadarProps {
  company?: Company | null;
  digests?: DigestWithItems[];
  votes?: Record<string, -1 | 1>;
  onVote?: (itemId: string, dir: "up" | "down") => void;
  onTrigger?: () => Promise<void>;
  triggering?: boolean;
}

const LENS_META: Record<EntityType, { label: string; badge: string; description: string }> = {
  competitor: {
    label: "Direkte Konkurrenz",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Gleicher Job, gleiche Zielgruppe.",
  },
  substitute: {
    label: "Substitute",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    description: "Anderer Weg zum selben Problem, auch DIY und Nichtstun.",
  },
  complement: {
    label: "Komplemente",
    badge: "bg-sky-100 text-sky-800 border-sky-300",
    description: "Läuft neben dem eigenen Produkt, Ökosystem und Integrationen.",
  },
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  page_diff: "Page-Diff",
  mention: "Mention",
  news: "News",
  baseline: "Baseline",
};

function VoteButtons({
  itemId,
  myVote,
  onVote,
}: {
  itemId?: string;
  myVote: -1 | 1 | undefined;
  onVote?: (id: string, dir: "up" | "down") => void;
}) {
  if (!itemId || !onVote) return null;
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

function DiffBlock({ diff }: { diff: { removed: string[]; added: string[] } }) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] overflow-hidden font-mono text-xs">
      {diff.removed.slice(0, 6).map((line, i) => (
        <div key={`r-${i}`} className="px-2.5 py-1 bg-red-50 text-red-800 line-through decoration-red-400">
          - {line}
        </div>
      ))}
      {diff.added.slice(0, 6).map((line, i) => (
        <div key={`a-${i}`} className="px-2.5 py-1 bg-emerald-50 text-emerald-800">
          + {line}
        </div>
      ))}
    </div>
  );
}

function HealthBadge({ entity }: { entity: RadarEntity }) {
  const entries = Object.entries(entity.fetch_health ?? {});
  if (entries.length === 0) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
      {entries.map(([kind, h]) => (
        <span
          key={kind}
          title={h.error ?? (h.word_count ? `${h.word_count} Wörter${h.via === "reader" ? ", via Reader" : ""}` : "")}
          className={`px-1.5 py-0.5 rounded border ${
            h.status === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {kind}: {h.status === "ok" ? "OK" : "Fehler"}
        </span>
      ))}
    </div>
  );
}

export function MarketRadar({
  company,
  digests,
  votes = {},
  onVote,
  onTrigger,
  triggering = false,
}: MarketRadarProps) {
  const [entities, setEntities] = useState<RadarEntity[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(Boolean(company));
  const [formError, setFormError] = useState<string | null>(null);
  // Linsen-Sektionen im Briefing: auf-/zuklappbar, standardmäßig offen.
  const [collapsedLenses, setCollapsedLenses] = useState<Record<string, boolean>>({});

  function toggleLens(lens: string) {
    setCollapsedLenses((prev) => ({ ...prev, [lens]: !prev[lens] }));
  }

  const demoMode = !company || tableMissing;

  const loadEntities = useCallback(async () => {
    if (!company) return;
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true });
    if (error) {
      // Tabelle existiert noch nicht (Migration 036 nicht angewendet): Demo-Modus.
      setTableMissing(true);
    } else {
      setTableMissing(false);
      setEntities((data ?? []) as RadarEntity[]);
    }
    setLoading(false);
  }, [company]);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  async function toggleEntity(id: string, active: boolean) {
    setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
    const { error } = await supabase.from("entities").update({ active }).eq("id", id);
    if (error) {
      setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, active: !active } : e)));
      setFormError(error.message);
    }
  }

  async function addEntity(name: string, type: EntityType, landing: string, pricing: string) {
    if (!company) return;
    setFormError(null);
    const urls: Record<string, string> = {};
    if (landing.trim()) urls.landing = landing.trim();
    if (pricing.trim()) urls.pricing = pricing.trim();
    const { data, error } = await supabase
      .from("entities")
      .insert({ company_id: company.id, name: name.trim(), type, urls })
      .select()
      .single();
    if (error) {
      setFormError(error.code === "23505" ? "Diese Entität gibt es schon." : error.message);
      return;
    }
    setEntities((prev) => [...prev, data as RadarEntity]);
  }

  // Neuester Radar-Digest plus Vote-Mapping signal_id -> digest_item.id.
  const latestDigest = (digests ?? [])[0] ?? null;
  const itemIdBySignal = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of latestDigest?.items ?? []) {
      const sid = (item.raw_json as { signal_id?: string } | null)?.signal_id;
      if (sid) map.set(sid, item.id);
    }
    return map;
  }, [latestDigest]);

  const clusters: RadarDigestCluster[] = useMemo(() => {
    if (demoMode) {
      // Demo: Mock-Signale in die Digest-Form bringen.
      const entityById = new Map(DEMO_ENTITIES.map((e) => [e.id, e]));
      return (["competitor", "substitute", "complement"] as EntityType[])
        .map((lens) => ({
          lens,
          signals: DEMO_SIGNALS
            .filter((s) => entityById.get(s.entityId)?.type === lens)
            .map((s): RadarDigestSignal => ({
              signal_id: s.id,
              entity_name: entityById.get(s.entityId)?.name ?? "",
              signal_type: s.signalType,
              title: s.title,
              what_happened: s.whatHappened,
              why_it_matters: s.whyItMatters,
              next_step: s.moveSuggestion,
              source_url: s.sourceUrl,
              source_name: s.sourceName,
              detected_at: s.detectedAt,
              severity: 3,
              score: 70,
              drift_flag: Boolean(s.categoryDrift),
              pinned: false,
              diff: s.diff ?? null,
            })),
        }))
        .filter((cl) => cl.signals.length > 0);
    }
    return ((latestDigest?.cluster_analyses ?? []) as unknown as RadarDigestCluster[])
      .filter((cl) => cl && Array.isArray(cl.signals));
  }, [demoMode, latestDigest]);

  const registryEntities: RadarEntity[] = demoMode
    ? DEMO_ENTITIES.map((d) => ({
        id: d.id,
        company_id: "demo",
        name: d.name,
        type: d.type,
        aliases: [],
        urls: d.urls,
        keywords: [],
        note: d.note ?? null,
        active: d.active,
        drift_streak: 0,
        fetch_health: {},
        created_at: "",
      }))
    : entities;

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)] py-8 text-center">Lade Market Radar...</p>;
  }

  return (
    <div>
      {demoMode && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="text-xs font-semibold text-blue-800">Vorschau mit Demo-Daten</div>
          <p className="text-xs text-blue-800 opacity-80 mt-0.5">
            {company
              ? "Das Radar-Backend ist noch nicht migriert (Tabelle entities fehlt). Nach der Migration erscheinen hier deine echten Entitäten."
              : "Dev-Preview ohne Login. Entitäten und Votes werden nicht gespeichert."}
          </p>
        </div>
      )}

      <EntityRegistry
        entities={registryEntities}
        demoMode={demoMode}
        formError={formError}
        onToggle={demoMode ? undefined : toggleEntity}
        onAdd={demoMode ? undefined : addEntity}
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                {demoMode
                  ? "Market Radar Briefing (Demo)"
                  : latestDigest?.title ?? "Noch kein Radar-Briefing"}
              </CardTitle>
              <CardDescription>
                {demoMode
                  ? "So sieht ein Radar-Briefing aus: Signale je Linse, mit Einordnung und nächstem Schritt."
                  : latestDigest
                  ? `Erzeugt ${formatDate(latestDigest.generated_at)}`
                  : "Lege Entitäten an und starte den ersten Radar-Lauf."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!demoMode && onTrigger && (
                <Button variant="secondary" size="sm" onClick={onTrigger} disabled={triggering}>
                  <Radar className={`w-4 h-4 mr-1 ${triggering ? "animate-spin" : ""}`} />
                  {triggering ? "Queued..." : "Radar-Lauf starten"}
                </Button>
              )}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-600 text-white">
                Market Radar
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clusters.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] py-4">
              {latestDigest
                ? "Keine relevanten Bewegungen in diesem Zeitraum. Eine unveränderte Landschaft erzeugt bewusst kein Rauschen."
                : "Noch kein Briefing. Der Radar-Lauf zieht Snapshots aller aktiven Entitäten, sammelt Mentions und baut daraus das erste Briefing (beim ersten Mal als Baseline-Übersicht)."}
            </p>
          ) : (
            <div className="space-y-6">
              {clusters.map((group) => {
                const lens = LENS_META[group.lens] ?? LENS_META.competitor;
                const collapsed = Boolean(collapsedLenses[group.lens]);
                return (
                  <section key={group.lens}>
                    <button
                      type="button"
                      onClick={() => toggleLens(group.lens)}
                      className="w-full flex items-center gap-2 mb-2 rounded-md px-1 py-1 -mx-1 hover:bg-[var(--color-bg)] transition-colors text-left"
                      title={collapsed ? "Sektion aufklappen" : "Sektion zuklappen"}
                    >
                      {collapsed
                        ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--color-muted)]" />
                        : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--color-muted)]" />}
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${lens.badge}`}>
                        {lens.label}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {group.signals.length} {group.signals.length === 1 ? "Signal" : "Signale"}
                      </span>
                      {!collapsed && (
                        <span className="text-[10px] text-[var(--color-muted)] hidden sm:inline">
                          · {lens.description}
                        </span>
                      )}
                    </button>
                    {!collapsed && (
                    <div className="grid gap-3">
                      {group.signals.map((signal) => (
                        <article
                          key={signal.signal_id}
                          className={`rounded-md border bg-[var(--color-surface)] p-3 ${
                            signal.pinned ? "border-amber-400" : "border-[var(--color-border)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <VoteButtons
                              itemId={itemIdBySignal.get(signal.signal_id)}
                              myVote={votes[`item:${itemIdBySignal.get(signal.signal_id)}`]}
                              onVote={onVote}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                {signal.source_url ? (
                                  <a
                                    href={signal.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug flex items-start gap-1 flex-1"
                                  >
                                    <span className="flex-1">{signal.title}</span>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                                  </a>
                                ) : (
                                  <span className="text-sm font-semibold leading-snug flex-1">{signal.title}</span>
                                )}
                                {signal.pinned && (
                                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                                    <Pin className="w-3 h-3" /> angepinnt
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
                                <span className="font-medium">{signal.entity_name}</span>
                                <span>· {SIGNAL_TYPE_LABELS[signal.signal_type] ?? signal.signal_type}</span>
                                {signal.source_name && <span>· {signal.source_name}</span>}
                                <span>· {new Date(signal.detected_at).toLocaleDateString("de-DE")}</span>
                                <span>· Severity {signal.severity}/5</span>
                              </div>
                              {signal.drift_flag && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                  <TriangleAlert className="w-3 h-3" />
                                  Kategorie-Drift: rückt näher an unser Feld
                                </div>
                              )}
                              <div className="mt-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                  Was passiert
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                                  {signal.what_happened}
                                </p>
                              </div>
                              {signal.diff && <DiffBlock diff={signal.diff} />}
                              {signal.why_it_matters && (
                                <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                                  {signal.why_it_matters}
                                </p>
                              )}
                              {signal.next_step && (
                                <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                    Nächster Schritt
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg)]">{signal.next_step}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EntityRegistry({
  entities,
  demoMode,
  formError,
  onToggle,
  onAdd,
}: {
  entities: RadarEntity[];
  demoMode: boolean;
  formError: string | null;
  onToggle?: (id: string, active: boolean) => void;
  onAdd?: (name: string, type: EntityType, landing: string, pricing: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("competitor");
  const [landing, setLanding] = useState("");
  const [pricing, setPricing] = useState("");
  const [saving, setSaving] = useState(false);

  const activeCount = entities.filter((e) => e.active).length;
  const order: EntityType[] = ["competitor", "substitute", "complement"];
  const sorted = [...entities].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.type !== b.type) return order.indexOf(a.type) - order.indexOf(b.type);
    return a.name.localeCompare(b.name);
  });

  async function submit() {
    if (!onAdd || !name.trim() || !landing.trim()) return;
    setSaving(true);
    try {
      await onAdd(name, type, landing, pricing);
      setName("");
      setLanding("");
      setPricing("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Beobachtete Entitäten</CardTitle>
            <CardDescription>
              {activeCount} aktiv von {entities.length}. Konkurrenz, Substitute und Komplemente,
              jede Entität wird wöchentlich auf Seiten-Änderungen und Signale geprüft.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            Entitäten
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-2 mb-4">
            {sorted.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">
                Noch keine Entitäten. Lege unten die erste an: dein wichtigster Konkurrent ist ein guter Start.
              </p>
            )}
            {sorted.map((entity) => {
              const lens = LENS_META[entity.type];
              const urls = Object.entries(entity.urls ?? {}).filter(([, u]) => Boolean(u)) as [string, string][];
              return (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onToggle?.(entity.id, !entity.active)}
                    disabled={!onToggle}
                    className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                      entity.active ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                    } ${!onToggle ? "opacity-60 cursor-default" : ""}`}
                    title={entity.active ? "Entität pausieren" : "Entität aktivieren"}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                        entity.active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{entity.name}</span>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${lens.badge}`}>
                        {lens.label}
                      </span>
                      {entity.drift_streak >= 2 && (
                        <span className="shrink-0 text-[10px] font-semibold text-amber-700">Drift-Streak {entity.drift_streak}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {urls.map(([kind, u]) => (
                        <a
                          key={kind}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          <span className="uppercase text-[9px] font-bold tracking-wider">{kind}</span>
                          <span className="truncate max-w-56">{u.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                    <HealthBadge entity={entity} />
                    {entity.note && (
                      <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{entity.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Radar className="w-4 h-4 text-[var(--color-muted)]" />
              <span className="text-xs font-bold uppercase tracking-wider">Entität hinzufügen</span>
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Name, Typ, Landing-URL. Die Pricing-URL ist optional, aber der wertvollste Beobachtungspunkt.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Name, z.B. Feedly"
                disabled={demoMode}
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EntityType)}
                className="text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                disabled={demoMode}
              >
                <option value="competitor">Konkurrent</option>
                <option value="substitute">Substitut</option>
                <option value="complement">Komplement</option>
              </select>
              <input
                value={landing}
                onChange={(e) => setLanding(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="https://konkurrent.com"
                type="url"
                disabled={demoMode}
              />
              <input
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="https://konkurrent.com/pricing (optional)"
                type="url"
                disabled={demoMode}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-[var(--color-muted)]">
                {demoMode ? "Im Demo-Modus deaktiviert." : "Beim ersten Radar-Lauf entsteht ein Baseline-Profil je Entität."}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={submit}
                disabled={demoMode || saving || !name.trim() || !landing.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                {saving ? "Speichere..." : "Hinzufügen"}
              </Button>
            </div>
            {formError && <p className="text-xs text-[var(--color-danger)] mt-2">{formError}</p>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
