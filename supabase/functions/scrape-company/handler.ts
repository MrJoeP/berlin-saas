// Bot: Scrape Company Website plus Konkurrenten, extrahiere strukturiertes Profile.
// Triggert: nach Company-Setup-Submit aus dem Frontend.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Job, Company, CompanyProfile } from "../_shared/types.ts";
import { callClaudeJSON, SONNET_MODEL } from "../_shared/claude.ts";

// TODO: FIRECRAWL_API_KEY in Supabase Vault setzen vor Tag 3.
// Alternative: simpler fetch + cheerio-ähnliches Parsing in Deno.
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

// Industrien-Liste muss synchron sein mit der industries-Tabelle.
const INDUSTRIES = [
  "AI Tools",
  "B2B SaaS",
  "DevTools",
  "E-Commerce",
  "FinTech",
  "HR Tech",
  "Marketing Tech",
  "Productivity",
];

const PROFILE_SYSTEM_PROMPT = `Du extrahierst ein strukturiertes Marketing-Profil aus einer Firmen-Website
plus eine Industrie-Klassifikation. Halte dich an das vorgegebene JSON-Schema.
Antworte nur mit JSON, keine Prosa.

Verfügbare Industries (wähle die beste Übereinstimmung, "Other" wenn nichts passt):
${INDUSTRIES.join(", ")}, Other

Schema:
{
  "tagline": "Prägnante One-Liner-Beschreibung der Firma.",
  "value_props": ["Wichtigste Wertversprechen, max 5"],
  "target_segments": ["Wer wird angesprochen, max 3"],
  "tone_signals": ["Wie klingt die Firma, z.B. 'developer-first', 'enterprise-formal'"],
  "key_terms": ["Branchen-Vokabular, max 10"],
  "industry": "Eine der vorgegebenen Industries",
  "niche": "Konkrete Nische in 5 bis 10 Wörtern, z.B. 'HR-Tech für Mittelstand DACH'",
  "keywords": ["3 bis 6 Keywords für News-Filter, einfache Begriffe ohne Sonderzeichen"]
}`;

export async function handle(job: Job, client: SupabaseClient): Promise<Record<string, unknown>> {
  if (!job.company_id) throw new Error("scrape_company benötigt company_id.");

  const { data: company, error: companyErr } = await client
    .from("companies")
    .select("*")
    .eq("id", job.company_id)
    .single();

  if (companyErr || !company) throw new Error(`Company ${job.company_id} nicht gefunden.`);
  if (!company.url) throw new Error("Company hat keine URL.");

  const markdown = await scrapeMarkdown(company.url);
  const profile = await extractProfile(markdown, company);

  // Industrie nur setzen wenn sie aus der vordefinierten Liste kommt.
  const validIndustry = INDUSTRIES.includes(profile.industry as string)
    ? (profile.industry as string)
    : null;

  await client
    .from("companies")
    .update({
      profile_json: profile,
      industry: company.industry ?? validIndustry,
      niche: company.niche ?? (profile.niche as string | null),
      keywords: company.keywords?.length
        ? company.keywords
        : ((profile.keywords as string[] | undefined) ?? []),
      tagline: company.tagline ?? (profile.tagline as string | null),
    })
    .eq("id", company.id);

  // Auto-Picking der Sources passend zur Industrie.
  let sourcesAdded = 0;
  if (validIndustry) {
    const { data: existingSources } = await client
      .from("company_sources")
      .select("source_id")
      .eq("company_id", company.id);

    if (!existingSources || existingSources.length === 0) {
      const { data: matchingSources } = await client
        .from("sources")
        .select("id")
        .contains("industry_tags", [validIndustry])
        .eq("is_default", true);

      if (matchingSources && matchingSources.length > 0) {
        const rows = matchingSources.map((s) => ({
          company_id: company.id,
          source_id: s.id,
          active: true,
        }));
        await client.from("company_sources").insert(rows);
        sourcesAdded = matchingSources.length;
      }
    }
  }

  // Konkurrenten — optional, scrape sie wenn vorhanden.
  const { data: competitors } = await client
    .from("competitors")
    .select("*")
    .eq("company_id", company.id);

  if (competitors && competitors.length > 0) {
    for (const competitor of competitors) {
      if (!competitor.url) continue;
      try {
        const compMarkdown = await scrapeMarkdown(competitor.url);
        const compProfile = await extractProfile(compMarkdown, competitor as unknown as Company);
        await client
          .from("competitors")
          .update({ profile_json: compProfile })
          .eq("id", competitor.id);
      } catch (err) {
        console.error(`Competitor ${competitor.id} scrape failed:`, err);
      }
    }
  }

  // Direkt den ersten News-Scrape anstoßen damit ein Digest entsteht.
  if (sourcesAdded > 0) {
    await client.from("jobs").insert({
      type: "niche_news_scrape",
      company_id: company.id,
      depends_on: [job.id],
    });
  }

  return {
    company_id: company.id,
    profile,
    industry: validIndustry,
    sources_added: sourcesAdded,
    competitors_scraped: competitors?.length ?? 0,
  };
}

async function scrapeMarkdown(url: string): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");

  // Fallback: simpler fetch wenn Firecrawl nicht konfiguriert.
  if (!key) {
    console.warn("FIRECRAWL_API_KEY nicht gesetzt, nutze simpler fetch fallback.");
    const response = await fetch(url, { headers: { "user-agent": "berlin-saas-bot/1.0" } });
    if (!response.ok) throw new Error(`Fetch ${url} failed: ${response.status}`);
    const html = await response.text();
    return stripHtmlSimple(html).slice(0, 30000);
  }

  const response = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });

  if (!response.ok) throw new Error(`Firecrawl ${url} failed: ${response.status}`);
  const data = await response.json();
  return data.data?.markdown ?? "";
}

function stripHtmlSimple(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractProfile(content: string, company: Company): Promise<CompanyProfile> {
  return await callClaudeJSON<CompanyProfile>({
    model: SONNET_MODEL,
    system: PROFILE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Firma: ${company.name}\nURL: ${company.url}\nIndustrie: ${company.industry ?? "unbekannt"}\n\nWebsite-Inhalt:\n\n${content.slice(0, 20000)}`,
      },
    ],
    max_tokens: 1500,
  });
}
