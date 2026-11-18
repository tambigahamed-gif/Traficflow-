export type AiProviderName = "gemini" | "groq";
export type AiMessages = { system: string; user: string };
export type AiProviderConfig = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
};
export type AiProviderStatus = {
  primary: { name: "gemini"; configured: boolean };
  fallback: { name: "groq"; configured: boolean };
  ready: boolean;
};

type Fetcher = typeof fetch;
type JsonObject = Record<string, unknown>;

export class AiProviderError extends Error {
  constructor(readonly provider: AiProviderName, readonly status?: number) {
    super(`${provider} request failed`);
    this.name = "AiProviderError";
  }
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured");
    this.name = "AiNotConfiguredError";
  }
}

export class AiGenerationError extends Error {
  constructor() {
    super("All configured AI providers failed");
    this.name = "AiGenerationError";
  }
}

const configured = (value: string | undefined) => Boolean(value?.trim());

export function getAiProviderStatus(env: AiProviderConfig = process.env as AiProviderConfig): AiProviderStatus {
  const geminiConfigured = configured(env.GEMINI_API_KEY);
  const groqConfigured = configured(env.GROQ_API_KEY);
  return {
    primary: { name: "gemini", configured: geminiConfigured },
    fallback: { name: "groq", configured: groqConfigured },
    ready: geminiConfigured || groqConfigured,
  };
}

async function readJson(response: Response, provider: AiProviderName): Promise<JsonObject> {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid response");
    return value as JsonObject;
  } catch {
    throw new AiProviderError(provider, response.status);
  }
}

function geminiText(body: JsonObject): string | null {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const text = steps
    .filter((step): step is JsonObject => Boolean(step && typeof step === "object" && !Array.isArray(step) && (step as JsonObject).type === "model_output"))
    .flatMap(step => Array.isArray(step.content) ? step.content : [])
    .filter((item): item is JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item) && (item as JsonObject).type === "text"))
    .map(item => typeof item.text === "string" ? item.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || null;
}

function groqText(body: JsonObject): string | null {
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const message = (first as JsonObject).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const content = (message as JsonObject).content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

async function callGemini(messages: AiMessages, env: AiProviderConfig, fetcher: Fetcher): Promise<string> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiProviderError("gemini");
  const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model: env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      system_instruction: messages.system,
      input: messages.user,
      store: false,
      generation_config: { max_output_tokens: 1200 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response, "gemini");
  if (!response.ok) throw new AiProviderError("gemini", response.status);
  const text = geminiText(body);
  if (!text) throw new AiProviderError("gemini", response.status);
  return text;
}

async function callGroq(messages: AiMessages, env: AiProviderConfig, fetcher: Fetcher): Promise<string> {
  const key = env.GROQ_API_KEY?.trim();
  if (!key) throw new AiProviderError("groq");
  const response = await fetcher("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
      max_completion_tokens: 1200,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response, "groq");
  if (!response.ok) throw new AiProviderError("groq", response.status);
  const text = groqText(body);
  if (!text) throw new AiProviderError("groq", response.status);
  return text;
}

export async function generateWithAiFallback(
  messages: AiMessages,
  env: AiProviderConfig = process.env as AiProviderConfig,
  fetcher: Fetcher = fetch,
): Promise<{ content: string; provider: AiProviderName }> {
  const status = getAiProviderStatus(env);
  if (!status.ready) throw new AiNotConfiguredError();

  const attempts: Array<{ name: AiProviderName; configured: boolean; run: () => Promise<string> }> = [
    { name: "gemini", configured: status.primary.configured, run: () => callGemini(messages, env, fetcher) },
    { name: "groq", configured: status.fallback.configured, run: () => callGroq(messages, env, fetcher) },
  ];

  for (const attempt of attempts) {
    if (!attempt.configured) continue;
    try {
      return { content: await attempt.run(), provider: attempt.name };
    } catch {
      // Don't log provider bodies, credentials, or user content. Try the next configured provider.
    }
  }
  throw new AiGenerationError();
}
