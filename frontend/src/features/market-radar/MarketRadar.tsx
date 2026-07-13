import { useMemo, useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
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
  DEMO_ENTITIES,
  DEMO_SIGNALS,
  type EntityType,
  type RadarEntity,
  type RadarSignal,
} from "./mockData";

// Woche 3: Market Radar. Drei Linsen auf das Marktumfeld, jedes Signal wird in
// einen Zug übersetzt: reagieren, agieren oder partnern.
// Aktuell Demo-Modus mit Mock-Daten. Backend (entities, entity_snapshots,
// entity_signals) folgt nach dem UI-Review.

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

const SIGNAL_TYPE_LABELS: Record<RadarSignal["signalType"], string> = {
  page_diff: "Page-Diff",
  mention: "Mention",
  news: "News",
  review: "Review",
};

function VoteButtons({
  signalId,
  myVote,
  onVote,
}: {
  signalId: string;
  myVote: -1 | 1 | undefined;
  onVote: (id: string, dir: "up" | "down") => void;
}) {
  return (
    <div className="shrink-0 flex flex-col items-center justify-center w-7">
      <button
        type="button"
        onClick={() => onVote(signalId, "up")}
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
        onClick={() => onVote(signalId, "down")}
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

function DiffBlock({ diff }: { diff: NonNullable<RadarSignal["diff"]> }) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] overflow-hidden font-mono text-xs">
      {diff.removed.map((line, i) => (
        <div key={`r-${i}`} className="px-2.5 py-1 bg-red-50 text-red-800 line-through decoration-red-400">
          - {line}
        </div>
      ))}
      {diff.added.map((line, i) => (
        <div key={`a-${i}`} className="px-2.5 py-1 bg-emerald-50 text-emerald-800">
          + {line}
        </div>
      ))}
    </div>
  );
}

function EntityRegistry({
  entities,
  onToggle,
  onAdd,
}: {
  entities: RadarEntity[];
  onToggle: (id: string, active: boolean) => void;
  onAdd: (name: string, type: EntityType, url: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("competitor");
  const [url, setUrl] = useState("");

  const activeCount = entities.filter((e) => e.active).length;
  const sorted = [...entities].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const order: EntityType[] = ["competitor", "substitute", "complement"];
    if (a.type !== b.type) return order.indexOf(a.type) - order.indexOf(b.type);
    return a.name.localeCompare(b.name);
  });

  function submit() {
    if (!name.trim() || !url.trim()) return;
    onAdd(name.trim(), type, url.trim());
    setName("");
    setUrl("");
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Beobachtete Entitäten</CardTitle>
            <CardDescription>
              {activeCount} aktiv von {entities.length}. Konkurrenz, Substitute und Komplemente,
              jede Entität wird auf Seiten-Änderungen und Signale überwacht.
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
            {sorted.map((entity) => {
              const lens = LENS_META[entity.type];
              const urls = Object.entries(entity.urls).filter(([, u]) => Boolean(u)) as [string, string][];
              return (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onToggle(entity.id, !entity.active)}
                    className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                      entity.active ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                    }`}
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
              Name, Typ und die wichtigste URL (Landing oder Pricing). Weitere URLs lassen sich später ergänzen.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1.5fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Name"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EntityType)}
                className="text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="competitor">Konkurrent</option>
                <option value="substitute">Substitut</option>
                <option value="complement">Komplement</option>
              </select>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 text-sm px-2 py-1.5 rounded border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="https://konkurrent.com/pricing"
                type="url"
              />
              <Button type="button" variant="secondary" size="sm" onClick={submit} disabled={!name.trim() || !url.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function MarketRadar() {
  const [entities, setEntities] = useState<RadarEntity[]>(DEMO_ENTITIES);
  const [votes, setVotes] = useState<Record<string, -1 | 1>>({});

  function toggleEntity(id: string, active: boolean) {
    setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }

  function addEntity(name: string, type: EntityType, url: string) {
    setEntities((prev) => [
      ...prev,
      { id: `ent-${Date.now()}`, name, type, urls: { landing: url }, active: true },
    ]);
  }

  // Demo-Votes bleiben lokal. Mit Backend läuft das über die geteilte votes-Tabelle.
  function vote(signalId: string, dir: "up" | "down") {
    const value: -1 | 1 = dir === "up" ? 1 : -1;
    setVotes((prev) => {
      const next = { ...prev };
      if (next[signalId] === value) delete next[signalId];
      else next[signalId] = value;
      return next;
    });
  }

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const activeSignals = DEMO_SIGNALS.filter((s) => entityById.get(s.entityId)?.active);

  const byLens: { type: EntityType; signals: RadarSignal[] }[] = (
    ["competitor", "substitute", "complement"] as EntityType[]
  )
    .map((type) => ({
      type,
      signals: activeSignals.filter((s) => entityById.get(s.entityId)?.type === type),
    }))
    .filter((group) => group.signals.length > 0);

  return (
    <div>
      {/* Demo-Hinweis, fliegt raus sobald das Backend dran hängt */}
      <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
        <div className="text-xs font-semibold text-blue-800">Vorschau mit Demo-Daten</div>
        <p className="text-xs text-blue-800 opacity-80 mt-0.5">
          UI-Review vor dem Backend-Bau. Entitäten und Votes werden noch nicht gespeichert.
        </p>
      </div>

      <EntityRegistry entities={entities} onToggle={toggleEntity} onAdd={addEntity} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Market Radar Briefing, 11.7.2026</CardTitle>
              <CardDescription>
                {activeSignals.length} Signale über {entities.filter((e) => e.active).length} beobachtete Entitäten,
                mit Einordnung und nächstem Schritt.
              </CardDescription>
            </div>
            <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-600 text-white">
              Market Radar
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {byLens.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] py-4">
              Keine aktiven Entitäten. Aktiviere oben mindestens eine, um Signale zu sehen.
            </p>
          ) : (
            <div className="space-y-6">
              {byLens.map((group) => {
                const lens = LENS_META[group.type];
                return (
                  <section key={group.type}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${lens.badge}`}>
                        {lens.label}
                      </span>
                      <span className="text-[10px] text-[var(--color-muted)]">{lens.description}</span>
                    </div>
                    <div className="grid gap-3">
                      {group.signals.map((signal) => {
                        const entity = entityById.get(signal.entityId);
                        return (
                          <article
                            key={signal.id}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                          >
                            <div className="flex items-start gap-3">
                              <VoteButtons signalId={signal.id} myVote={votes[signal.id]} onVote={vote} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  <a
                                    href={signal.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline leading-snug flex items-start gap-1 flex-1"
                                  >
                                    <span className="flex-1">{signal.title}</span>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                                  </a>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
                                  <span className="font-medium">{entity?.name}</span>
                                  <span>· {SIGNAL_TYPE_LABELS[signal.signalType]}</span>
                                  <span>· {signal.sourceName}</span>
                                  <span>· {new Date(signal.detectedAt).toLocaleDateString("de-DE")}</span>
                                </div>
                                {signal.categoryDrift && (
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
                                    {signal.whatHappened}
                                  </p>
                                </div>
                                {signal.diff && <DiffBlock diff={signal.diff} />}
                                <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                                  {signal.whyItMatters}
                                </p>
                                <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                    Nächster Schritt
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg)]">{signal.moveSuggestion}</p>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
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
