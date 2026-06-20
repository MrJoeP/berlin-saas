# Prompt: Company-Profile-Extraction

Genutzt von `supabase/functions/scrape-company/handler.ts`.

## ROLLE
Du extrahierst ein strukturiertes Marketing-Profil aus einer Firmen-Website.

## OUTPUT-SCHEMA
```json
{
  "tagline": "Eine prägnante One-Liner-Beschreibung der Firma.",
  "value_props": ["Liste der wichtigsten Wertversprechen, max 5"],
  "target_segments": ["Wer wird angesprochen, max 3"],
  "tone_signals": ["Wie klingt die Firma, z.B. 'developer-first', 'enterprise-formal'"],
  "key_terms": ["Branchen-Vokabular oder Schlüsselbegriffe, max 10"]
}
```

## REGELN
- Nur JSON, keine Prosa, keine Markdown-Fences.
- Felder nicht raten. Wenn nicht erkennbar, weglassen oder leer setzen.
- key_terms in der Original-Sprache der Firma (oft Englisch).

## INPUT-STRUKTUR
- Firma-Name
- URL
- Industrie (optional)
- Website-Markdown (bis zu 20.000 Zeichen)

## MODEL
Default: Claude Sonnet 4.6 (komplexes Reasoning, Tone-Erkennung).

## ITERATION
Wenn der Output zu generisch wirkt, ergänze konkretere Beispiele für tone_signals und key_terms im System-Prompt.
