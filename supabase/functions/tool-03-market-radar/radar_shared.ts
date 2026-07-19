// Market Radar: geteilte Bausteine für Snapshot/Diff.
// Fetch-Leiter (plain -> Reader-Fallback), SSRF-Schutz, Text-Extraktion,
// Normalisierung, zeilenbasierter Diff, Noise-Gate. Siehe ALGORITHMS.md + CHALLENGE.md.

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
export const MIN_WORDS = 150;

export const PRICE_PATTERN = /\d+[.,]?\d*\s*(€|\$|usd|eur)|(€|\$)\s*\d+|\/\s*(mo|month|monat|yr|year|jahr)/i;
const SIGNAL_WORDS = /launch|new |now available|introducing|deprecated|discontinu|sunset|free plan|enterprise|pro plan|premium|trial|beta|api|integration/i;

// SSRF-Schutz: nur http(s), keine privaten Hosts/IPs.
export function guardUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`URL-Schema nicht erlaubt: ${u.protocol}`);
  }
  const host = u.hostname.toLowerCase();
  const privateHost = host === "localhost" || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "169.254.169.254";
  const ipLike = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const privateIp = ipLike && (
    host.startsWith("10.") || host.startsWith("127.") ||
    host.startsWith("192.168.") || host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
  if (privateHost || privateIp || (ipLike && !privateIp)) {
    // Auch öffentliche rohe IPs blocken: Entitäten haben Domains.
    throw new Error(`Host nicht erlaubt: ${host}`);
  }
  return u;
}

async function fetchWithLimit(url: string, accept: string): Promise<string> {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        accept,
      },
      signal: ac.signal,
      redirect: "follow",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    // Redirect-Ziel erneut gegen SSRF prüfen.
    guardUrl(r.url);
    const reader = r.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    reader.cancel().catch(() => {});
    const buf = new Uint8Array(total);
    let off = 0;
    for (const ch of chunks) {
      buf.set(ch.subarray(0, Math.min(ch.byteLength, total - off)), off);
      off += ch.byteLength;
      if (off >= total) break;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } finally {
    clearTimeout(tm);
  }
}

// Sichtbaren Text aus HTML ziehen. Nav/Footer/Script/Style raus, Blöcke als Zeilen.
export function extractText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Block-Grenzen als Zeilenumbrüche erhalten.
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|section|article|td)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#?\w+;/g, " ");
  const lines = s.split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3);
  return lines.join("\n");
}

// Dynamisches Rauschen neutralisieren, Preise bleiben drin.
export function normalizeText(text: string): string {
  return text.split("\n").map((line) =>
    line
      // Datumsangaben und Jahre in Copyright-Zeilen.
      .replace(/\b\d{1,2}\.\s?(jan|feb|mar|mär|apr|may|mai|jun|jul|aug|sep|okt|oct|nov|dez|dec)[a-z]*\.?\s?\d{2,4}\b/gi, "<date>")
      .replace(/\b(jan|feb|mar|mär|apr|may|mai|jun|jul|aug|sep|okt|oct|nov|dez|dec)[a-z]*\.?\s\d{1,2},?\s?\d{2,4}\b/gi, "<date>")
      .replace(/©\s?\d{4}/g, "©<year>")
      // Zähler ohne Währungsbezug (Reviews, Nutzerzahlen mit + Suffix).
      .replace(/\b\d{1,3}(,\d{3})+\+?\s?(users|customers|reviews|companies|teams)\b/gi, "<count> $2")
      // Session-/Tracking-Query-Reste in sichtbaren URLs.
      .replace(/[?&](utm_[a-z]+|ref|sid|session)=[^\s&]+/gi, "")
  ).join("\n");
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface FetchOutcome {
  ok: boolean;
  text: string;
  wordCount: number;
  via: "plain" | "reader" | "none";
  error?: string;
}

// Fetch-Leiter: plain fetch -> wenn zu dünn (SPA) oder Pricing ohne Preise -> r.jina.ai Reader.
export async function fetchPageText(rawUrl: string, urlKind: string): Promise<FetchOutcome> {
  guardUrl(rawUrl);
  let plainError = "";
  try {
    const html = await fetchWithLimit(rawUrl, "text/html,application/xhtml+xml");
    const text = extractText(html);
    const words = text.split(/\s+/).filter(Boolean).length;
    const thin = words < MIN_WORDS;
    const pricingWithoutPrices = urlKind === "pricing" && !PRICE_PATTERN.test(text);
    if (!thin && !pricingWithoutPrices) {
      return { ok: true, text, wordCount: words, via: "plain" };
    }
    plainError = thin ? `nur ${words} Wörter (SPA?)` : "Pricing ohne Preis-Pattern";
  } catch (e) {
    plainError = e instanceof Error ? e.message : String(e);
  }
  // Reader-Fallback rendert JS-Seiten und liefert Klartext.
  try {
    const readerUrl = `https://r.jina.ai/${rawUrl}`;
    const text = (await fetchWithLimit(readerUrl, "text/plain")).trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words >= MIN_WORDS) {
      return { ok: true, text, wordCount: words, via: "reader" };
    }
    return { ok: false, text: "", wordCount: words, via: "none", error: `plain: ${plainError}; reader: nur ${words} Wörter` };
  } catch (e) {
    const readerError = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", wordCount: 0, via: "none", error: `plain: ${plainError}; reader: ${readerError}` };
  }
}

// Doppel-Fetch gegen A/B-Rotation: nur der stabile Schnitt beider Läufe wird gedifft.
export async function fetchStableText(rawUrl: string, urlKind: string): Promise<FetchOutcome> {
  const first = await fetchPageText(rawUrl, urlKind);
  if (!first.ok) return first;
  const second = await fetchPageText(rawUrl, urlKind);
  if (!second.ok) return first; // zweiter Lauf wackelt: konservativ ersten nehmen
  if (first.text === second.text) return first;
  const setB = new Set(second.text.split("\n"));
  const stable = first.text.split("\n").filter((l) => setB.has(l)).join("\n");
  const words = stable.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS) return first; // Schnitt zu dünn, Rotation dominiert: ersten nehmen
  return { ok: true, text: stable, wordCount: words, via: first.via };
}

export interface DiffResult {
  removed: string[];
  added: string[];
  changedChars: number;
  changedRatio: number;
  hasPriceChange: boolean;
  hasSignalWords: boolean;
}

export function diffTexts(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const removed = oldLines.filter((l) => !newSet.has(l));
  const added = newLines.filter((l) => !oldSet.has(l));
  const changedChars = [...removed, ...added].reduce((n, l) => n + l.length, 0);
  const totalChars = Math.max(1, oldText.length);
  const joined = [...removed, ...added].join("\n");
  return {
    removed: removed.slice(0, 40),
    added: added.slice(0, 40),
    changedChars,
    changedRatio: changedChars / totalChars,
    hasPriceChange: PRICE_PATTERN.test(joined),
    hasSignalWords: SIGNAL_WORDS.test(joined),
  };
}

// Noise-Gate: kleine Diffs ohne Signal-Muster verwerfen.
export function passesNoiseGate(d: DiffResult): boolean {
  if (d.changedChars < 40 && !d.hasPriceChange && !d.hasSignalWords) return false;
  return d.removed.length > 0 || d.added.length > 0;
}
