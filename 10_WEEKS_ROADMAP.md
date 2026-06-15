# 10 WOCHEN ROADMAP

Basis: [GENERAL_CONSTRUCT.md](GENERAL_CONSTRUCT.md). Alles hier erbt von dort. Filter-Check (Buzzmatic + Agentur) gilt vor jedem Bau.

## KONZEPT
Zentrale Knowledge-Base füllt sich über die 10 Wochen. Erste Wochen sammeln Informationen, spätere Wochen verwerten sie zu echten Marketing-Assets. Zielgruppe sind junge Founder und Startups. Kein aktiver Verkauf, kein Sales-Track. Distribution über LinkedIn (Build-in-Public). Personal Brand und Agentur-Werkzeugkasten sind die Ziele.

## STRUKTUR
- W1: Foundation. Setup integriert in den ersten Info-Bot.
- W2 bis W4: Info-Sammler. Knowledge-Base wächst.
- W5 bis W10: Asset-Producer mit Komplexitäts-Steigerung.

## STATUS-LEGENDE
- **FIX**: Modul ist final beschlossen.
- **SKELETT**: Modul ist gesetzt, aber austauschbar.
- **OFFEN**: Slot ist frei, wird im Verlauf entschieden.

## 10-WOCHEN-PLAN

| Woche | Modul | Status | Funktion |
|---|---|---|---|
| 1 | Niche-News-Digest + Company-Setup | FIX | Foundation, Datenschema, Knowledge-Base. Erster Info-Bot live. |
| 2 | Top-Post-Digest | FIX | LinkedIn-Scrape, Hook-Patterns aus der Nische. |
| 3 | Wettbewerbs-Monitor | FIX | Deep-Track auf benannte Konkurrenz, Sales-Page-Diffs. |
| 4 | UGC-Hunter | FIX | Multi-Source-Mentions, Quote-Extraction. |
| 5 | FAQ- und Objection-Handler | SKELETT | Erster Asset. Pull aus UGC und Wettbewerbs-Monitor. |
| 6 | One-Pager-Builder | SKELETT | Klassisches Asset, einmaliger PDF. |
| 7 | OFFEN | OFFEN | Asset-Producer, mittlere Komplexität. |
| 8 | Lead-Magnet-Engine | SKELETT | PDF mit Recherche-Tiefe. |
| 9 | Newsletter-Engine | SKELETT | Recurring plus Versand-Provider. |
| 10 | OFFEN (Endgegner) | OFFEN | Höchste Komplexität. Sozial-Post-Builder, Bild- und Video-Engine, oder anderes. |

## LINKEDIN-PFLICHT-OUTPUTS PRO WOCHE
- **Kickoff**: Was diese Woche gebaut wird und warum. Problem zuerst.
- **Launch**: Fertiges Tool, kurze Demo, klarer nächster Schritt für den Leser.
- **Mid-week (optional)**: Echte Hürde oder Learning, nur wenn die Woche etwas Erzählenswertes hergibt.

Stil immer Englisch, erste Person, Hook zuerst. Posts greifen über die Wochen ineinander, roter Faden über die ganze Serie.

## OFFENE PUNKTE FÜR WOCHE 1
1. Konkrete Nische als Test-Persona für das Setup-Tool.
2. Output-Format für Niche-News-Digest (Email, Slack, Notion, Web-Dashboard).
3. Quellen-Set für Niche-News-Digest (RSS, NewsAPI, Subreddits, X-Listen).
4. Stack-Bestätigung: n8n als Orchestrator, Supabase mit pgvector als Knowledge-Storage, Lovable als Mini-Frontend, Claude API als LLM.
