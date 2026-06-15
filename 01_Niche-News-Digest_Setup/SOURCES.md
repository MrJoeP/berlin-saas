# Quellen-Set

Umfangreicher Approach. Founder bekommt 40+ Quellen pro Industrie als Vorschlag, wählt aus, kann ergänzen.

## TYPEN

### RSS
- Industrie-Newsletter (Substack, Medium, Beehiiv)
- Tech-Blogs
- Branchen-Magazine
- Eigene Wettbewerbs-Blogs

Parser: feedparser oder rss-parser, robust gegen kaputte Feeds.

### NewsAPI
- NewsAPI.org als Start (1000 Calls free, dann 449 USD pro Monat).
- Mediastack als Alternative (kostenlos bis 500 Calls).
- GNews als zweite Alternative.

Pro Company: Keywords plus Industrie als Such-Query.

### Reddit
- Reddit-API offiziell (OAuth, kostenlos).
- Subreddits werden pro Industrie vorgeschlagen, Founder bestätigt.
- Pro Subreddit: top posts der Woche plus rising posts.

Beispiele pro Industrie:
- SaaS: r/SaaS, r/startups, r/Entrepreneur
- AI: r/MachineLearning, r/LocalLLaMA, r/AI_Agents
- DevTools: r/programming, r/devops, r/webdev
- HR-Tech: r/humanresources, r/recruiting
- E-Commerce: r/ecommerce, r/shopify, r/FulfillmentByAmazon

### Hacker News
- Algolia-API (kostenlos, kein Auth).
- Filter: Stories mit Industrie-Keywords, Score über 50.

### ProductHunt
- ProductHunt-API (OAuth, kostenlos).
- Filter: neue Launches in der Industrie.

### Twitter / X
Optional in W1. X-API ist teuer (100 USD pro Monat für Basic). Alternative: Nitter-Scraping, riskanter aber kostenlos.
Wenn rein, dann definierte Listen pro Industrie.

## INDUSTRIE-MAPPING
Tabelle in Supabase. Beispiel:

| Industrie | Standard-Sources |
|---|---|
| B2B-SaaS | NewsAPI (Keywords: SaaS, B2B), r/SaaS, r/startups, HN (Score 100+), ProductHunt SaaS-Tag, ausgewählte Substacks |
| AI-Tools | r/AI_Agents, HN (AI-Topic), ProductHunt AI-Tag, ausgewählte Substacks (Latent Space, Last Week in AI) |
| HR-Tech | NewsAPI (HR-Tech, Recruiting), r/humanresources, HR Brew Newsletter |
| Marketing | NewsAPI, r/marketing, Marketing Brew, Demand Curve Newsletter |

Master-Liste wird in Tag 1 angelegt. Pro Industrie zehn bis fünfzehn Sources als Default.

## SCRAPE-RHYTHMUS
- News-APIs und Hacker News: täglich.
- Reddit und ProductHunt: alle zwei Tage.
- RSS: täglich.
- Digest-Generation: einmal pro Woche, Montag früh.

## DEDUPLIZIERUNG
- Items werden über Title-Hash plus URL deduped.
- Cluster über Claude API verhindert thematische Doubletten in einem Digest.

## OFFENE PUNKTE
- Source-Health-Check: was tun wenn ein Feed wochenlang nichts liefert? Im Dashboard markieren, nicht stillschweigend ignorieren.
- Founder-Custom-Sources: erlauben, dass Founder eigene URLs hinzufügt. UI-Schritt in Tag 2.
