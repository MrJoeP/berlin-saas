// Demo-Daten für den Market Radar (Woche 3), solange das Backend noch nicht steht.
// Die Demo trackt das Marktumfeld des eigenen Digest-Tools. Nach Review werden
// diese Daten durch entities/entity_signals aus Supabase ersetzt.

export type EntityType = "competitor" | "substitute" | "complement";
export type RadarMove = "react" | "act" | "partner";
export type SignalType = "page_diff" | "mention" | "news" | "review";

export interface RadarEntity {
  id: string;
  name: string;
  type: EntityType;
  urls: { landing?: string; pricing?: string; changelog?: string };
  active: boolean;
  note?: string;
}

export interface RadarSignal {
  id: string;
  entityId: string;
  signalType: SignalType;
  title: string;
  sourceName: string;
  sourceUrl: string;
  detectedAt: string;
  whatHappened: string;
  whyItMatters: string;
  recommendedMove: RadarMove;
  moveSuggestion: string;
  diff?: { removed: string[]; added: string[] };
  categoryDrift?: boolean;
}

export const DEMO_ENTITIES: RadarEntity[] = [
  {
    id: "ent-feedly",
    name: "Feedly",
    type: "competitor",
    urls: { landing: "https://feedly.com", pricing: "https://feedly.com/i/pro" },
    active: true,
  },
  {
    id: "ent-brand24",
    name: "Brand24",
    type: "competitor",
    urls: { landing: "https://brand24.com", pricing: "https://brand24.com/prices/" },
    active: true,
  },
  {
    id: "ent-galerts",
    name: "Google Alerts",
    type: "substitute",
    urls: { landing: "https://www.google.com/alerts" },
    active: true,
    note: "Der Default, den jeder Founder zuerst nutzt.",
  },
  {
    id: "ent-diy",
    name: "ChatGPT Deep Research",
    type: "substitute",
    urls: { landing: "https://chatgpt.com" },
    active: true,
    note: "Manuelle Recherche auf Zuruf statt laufendem Monitoring.",
  },
  {
    id: "ent-notion",
    name: "Notion",
    type: "complement",
    urls: { landing: "https://notion.so", changelog: "https://www.notion.com/releases" },
    active: true,
    note: "Ablageort vieler Briefings beim ICP.",
  },
  {
    id: "ent-slack",
    name: "Slack",
    type: "complement",
    urls: { landing: "https://slack.com", changelog: "https://slack.com/release-notes" },
    active: false,
    note: "Delivery-Kanal, Integration denkbar.",
  },
];

export const DEMO_SIGNALS: RadarSignal[] = [
  {
    id: "sig-1",
    entityId: "ent-feedly",
    signalType: "page_diff",
    title: "Feedly hebt Pro+ Pricing an und bündelt AI-Features neu",
    sourceName: "Pricing-Page-Diff",
    sourceUrl: "https://feedly.com/i/pro",
    detectedAt: "2026-07-11",
    whatHappened:
      "Auf der Pricing-Seite ist Pro+ von 8,25 auf 12 Dollar pro Monat gestiegen. Die AI-Zusammenfassungen sind aus dem Enterprise-Plan in Pro+ gewandert.",
    whyItMatters:
      "Der direkteste Konkurrent macht AI-Digests zum Standard-Feature im Mittelklasse-Plan. Der Preisabstand nach oben wird größer, das öffnet Raum für ein günstigeres, spitzeres Angebot.",
    recommendedMove: "react",
    moveSuggestion:
      "Eigene Pricing-Argumentation prüfen. Vergleichstabelle aktualisieren, den Preissprung in Objection-Handling und Sales-Notizen aufnehmen.",
    diff: {
      removed: ["Pro+  $8.25 / month, billed annually", "AI Actions: Enterprise only"],
      added: ["Pro+  $12 / month, billed annually", "AI Actions & Summaries: included in Pro+"],
    },
  },
  {
    id: "sig-2",
    entityId: "ent-galerts",
    signalType: "mention",
    title: "Reddit-Thread mit Traktion: Google Alerts verpasst die Hälfte der Mentions",
    sourceName: "r/Entrepreneur",
    sourceUrl: "https://www.reddit.com/r/Entrepreneur",
    detectedAt: "2026-07-10",
    whatHappened:
      "Ein Thread mit über 400 Upvotes sammelt Beispiele, wo Google Alerts Erwähnungen erst Tage später oder gar nicht liefert. Mehrere Kommentare fragen offen nach Alternativen.",
    whyItMatters:
      "Das meistgenutzte Substitut zeigt öffentlich Schwäche, und genau unsere Zielgruppe diskutiert Alternativen. Das ist ein offenes Zeitfenster für Vergleichs-Content.",
    recommendedMove: "act",
    moveSuggestion:
      "Content-Stück bauen: warum Alerts Mentions verpassen und wie ein Digest-Ansatz das löst. Im Thread hilfreich antworten, ohne zu pitchen.",
  },
  {
    id: "sig-3",
    entityId: "ent-notion",
    signalType: "news",
    title: "Notion öffnet Webhooks und automatisierte Datenbank-Einträge für alle Pläne",
    sourceName: "Notion Releases",
    sourceUrl: "https://www.notion.com/releases",
    detectedAt: "2026-07-09",
    whatHappened:
      "Notion hat Webhooks und API-Schreibzugriff auf Datenbanken aus dem Plus-Plan in den Free-Plan geholt. Automationen sind damit für jeden Workspace verfügbar.",
    whyItMatters:
      "Viele im ICP sammeln Briefings ohnehin in Notion. Ein Digest-zu-Notion-Export wird damit für die gesamte Nutzerbasis möglich statt nur für zahlende Workspaces.",
    recommendedMove: "partner",
    moveSuggestion:
      "Notion-Export als Integration priorisieren. Template mitliefern und den Launch als gemeinsame Story erzählen: Briefing landet direkt in der Wissensbasis.",
  },
  {
    id: "sig-4",
    entityId: "ent-brand24",
    signalType: "page_diff",
    title: "Brand24 positioniert sich neu Richtung AI-Insights für Agenturen",
    sourceName: "Landing-Page-Diff",
    sourceUrl: "https://brand24.com",
    detectedAt: "2026-07-08",
    whatHappened:
      "Die Hero-Headline wechselt von Media-Monitoring zu AI-powered Insights for Agencies. Neuer Abschnitt mit Agentur-Logos und einem White-Label-Hinweis.",
    whyItMatters:
      "Ein Monitoring-Anbieter schwenkt auf genau das Agentur-Segment, das wir später bedienen wollen. Die Positionierung rückt näher an unser Feld heran.",
    recommendedMove: "react",
    moveSuggestion:
      "Beobachtung verschärfen und die eigene Agentur-Erzählung schärfen. Kein Panik-Move, aber ins Wochen-Review aufnehmen.",
    diff: {
      removed: ["Media monitoring for every team"],
      added: ["AI-powered insights for agencies", "White-label reports for your clients"],
    },
    categoryDrift: true,
  },
  {
    id: "sig-5",
    entityId: "ent-diy",
    signalType: "mention",
    title: "Deep-Research-Workflows ersetzen bei Foundern das laufende Monitoring noch nicht",
    sourceName: "Hacker News",
    sourceUrl: "https://news.ycombinator.com",
    detectedAt: "2026-07-07",
    whatHappened:
      "Diskussion über Research-Agenten: stark für einmalige Tiefenrecherche, aber mehrere Stimmen beschreiben, dass niemand daraus ein verlässliches wöchentliches Briefing gebaut bekommt.",
    whyItMatters:
      "Das stärkste DIY-Substitut hat eine sichtbare Lücke: Wiederholbarkeit. Genau die füllt ein stehender Digest mit Lernschleife.",
    recommendedMove: "act",
    moveSuggestion:
      "Positionierung schärfen: einmalige Recherche vs. stehendes Radar. Einen Post aus dem Vergleich bauen, die Zitate liegen im Thread.",
  },
];
