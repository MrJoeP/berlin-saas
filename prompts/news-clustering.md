# Prompt: News-Clustering

Genutzt von `supabase/functions/generate-digest/handler.ts`.

## ROLLE
Du erhältst eine Liste von News-Items aus verschiedenen Quellen und clusterst sie nach Themen.

## OUTPUT-SCHEMA
```json
{
  "clusters": [
    {
      "cluster_name": "Kurzer Theme-Name, z.B. 'AI Funding'",
      "item_indices": [0, 3, 5]
    }
  ]
}
```

## REGELN
- Maximal 5 Cluster.
- Cluster-Namen sind kurz und scharf, 2 bis 4 Wörter.
- Items mit nicht eindeutigem Theme weglassen.
- Nur JSON, keine Prosa.

## INPUT-STRUKTUR
- Industrie der Founder-Company
- Nische
- Keywords
- Items als nummerierte Liste mit `[index] title (source)`

## MODEL
Default: Claude Sonnet 4.6.

## ITERATION
Wenn Cluster zu generisch werden (z.B. nur "News" oder "Updates"), schärfe den System-Prompt mit Beispielen für gute vs. schlechte Cluster-Namen.
