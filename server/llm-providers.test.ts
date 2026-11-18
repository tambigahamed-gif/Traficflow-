import { describe, expect, it, vi } from "vitest";
import { AiNotConfiguredError, generateWithAiFallback, getAiProviderStatus } from "./integrations/llm-providers";

const messages = { system: "Tu es un assistant éditorial.", user: "Présente une collection de printemps." };
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("fournisseurs IA TrafficFlow", () => {
  it("expose le statut sans révéler de valeur de secret", () => {
    expect(getAiProviderStatus({ GEMINI_API_KEY: "secret-one" })).toEqual({
      primary: { name: "gemini", configured: true },
      fallback: { name: "groq", configured: false },
      ready: true,
    });
  });

  it("refuse sans appeler de fournisseur quand aucune clé n’est présente", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateWithAiFallback(messages, {}, fetcher)).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("utilise Gemini en priorité avec conservation désactivée", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: "Une proposition éditoriale." }] }],
    }));
    const result = await generateWithAiFallback(messages, { GEMINI_API_KEY: "test-gemini", GROQ_API_KEY: "test-groq" }, fetcher);
    expect(result).toEqual({ content: "Une proposition éditoriale.", provider: "gemini" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-gemini");
    const body = JSON.parse(String(init?.body));
    expect(body.store).toBe(false);
    expect(body.model).toBe("gemini-3.8-flash");
    expect(body.input).toBe(messages.user);
  });

  it("bascule vers Groq si Gemini est en échec", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "temporary" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "Texte livré par le repli." } }] }));
    const result = await generateWithAiFallback(messages, { GEMINI_API_KEY: "test-gemini", GROQ_API_KEY: "test-groq" }, fetcher);
    expect(result).toEqual({ content: "Texte livré par le repli.", provider: "groq" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-groq");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.messages).toHaveLength(2);
  });

  it("essaie Groq seul s’il est le seul fournisseur configuré", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "Réponse Groq" } }] }));
    const result = await generateWithAiFallback(messages, { GROQ_API_KEY: "test-groq", GROQ_MODEL: "test-model" }, fetcher);
    expect(result.provider).toBe("groq");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).model).toBe("test-model");
  });
});
