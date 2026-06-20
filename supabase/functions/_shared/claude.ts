// Claude-API-Client für Edge Functions.
// Default-Modell: Haiku 4.5 (schnell, günstig).
// Für komplexere Tasks (Profile-Extraction, Clustering) kann auf Sonnet 4.6 hochgestuft werden.

// TODO: ANTHROPIC_API_KEY in Supabase Vault setzen vor Tag 4.
// Setup: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

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
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function callClaude(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY nicht gesetzt. Vault prüfen.");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.max_tokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      system: options.system,
      messages: options.messages,
    }),
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
    },
  };
}

export async function callClaudeJSON<T>(options: ClaudeCallOptions): Promise<T> {
  const response = await callClaude({
    ...options,
    system: (options.system ?? "") +
      "\n\nResponse MUST be valid JSON only, no prose, no markdown fences.",
  });

  try {
    // Manchmal kommt JSON in fences trotz Anweisung. Cleanup.
    const cleaned = response.content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`Claude-Response war kein valides JSON: ${response.content.slice(0, 200)}`);
  }
}

export { DEFAULT_MODEL, SONNET_MODEL };
