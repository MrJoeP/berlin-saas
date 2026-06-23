// Claude-API-Client für Edge Functions.
// Default-Modell: Haiku 4.5 — übernimmt Clustering UND Deep-Synthesis (on mass).
// Sonnet 4.6 nur für Profile-Extraction beim Company-Setup.
//
// Prompt-Caching: System-Prompts ab 1024 Tokens werden über cache_control "ephemeral"
// für 5 Min gecached. Sparpotenzial bei wiederholten Calls im selben Run: ~90%.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCallOptions {
  model?: string;
  system?: string;
  cacheSystem?: boolean; // Wenn true und system ≥1024 chars: Prompt-Caching aktivieren.
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export async function callClaude(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY nicht gesetzt.");

  // System-Prompt entweder als String oder mit cache_control übergeben.
  let systemPayload: unknown = options.system;
  if (options.cacheSystem && options.system && options.system.length >= 1024) {
    systemPayload = [
      { type: "text", text: options.system, cache_control: { type: "ephemeral" } },
    ];
  }

  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.max_tokens ?? 2048,
    temperature: options.temperature ?? 0,
    system: systemPayload,
    messages: options.messages,
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude-API Fehler: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const content = data.content
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n");

  return {
    content,
    usage: {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens,
      cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
      cache_read_input_tokens: data.usage.cache_read_input_tokens,
    },
  };
}

export async function callClaudeJSON<T>(options: ClaudeCallOptions): Promise<T> {
  const response = await callClaude({
    ...options,
    system: (options.system ?? "") +
      "\n\nResponse MUST be valid JSON only, no prose, no markdown fences.",
  });
  const candidate = extractJsonBlock(response.content);
  try {
    return JSON.parse(candidate) as T;
  } catch (_err) {
    throw new Error(`Claude-Response war kein valides JSON: ${response.content.slice(0, 200)}`);
  }
}

// Robuste JSON-Extraktion: Haiku wrappt trotz Anweisung oft in ```json-Fences
// oder schreibt Prosa drumherum. Wir ziehen den Fence-Inhalt raus (auch mittendrin)
// und schneiden auf das äußerste {...}. Fängt die häufigen Fence- und Prosa-Fälle ab.
function extractJsonBlock(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

export { DEFAULT_MODEL, SONNET_MODEL };
