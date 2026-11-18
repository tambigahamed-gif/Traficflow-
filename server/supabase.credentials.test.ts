import { describe, expect, it } from "vitest";

describe("Supabase project credentials", () => {
  it("accepts the publishable key on the Auth settings endpoint", async () => {
    const baseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(baseUrl, "VITE_SUPABASE_URL is required").toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(publishableKey, "VITE_SUPABASE_PUBLISHABLE_KEY is required").toBeTruthy();
    expect(publishableKey).not.toMatch(/service[_-]?role|sb_secret_/i);

    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.status, "Supabase Auth settings must accept this key").toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    const settings = await response.json() as Record<string, unknown>;
    expect(settings).toBeTruthy();
    expect(typeof settings).toBe("object");
  }, 20_000);
});
