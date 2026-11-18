import { describe, expect, it, vi } from "vitest";
import { createApiFetch } from "../client/src/lib/api-fetch";

describe("API fetch error responses", () => {
  it("surfaces Vercel error code, body and request id when the API returns text", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      "A server error has occurred\nFUNCTION_INVOCATION_FAILED\niad1::trace-123",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8", "x-vercel-error": "FUNCTION_INVOCATION_FAILED" } },
    ));

    await expect(createApiFetch(fetchMock)("/api/trpc/workspace.list"))
      .rejects.toThrow(/HTTP 500.*FUNCTION_INVOCATION_FAILED.*trace-123/);
  });

  it("rejects HTML fallbacks with a useful HTTP/content-type diagnosis", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("<!doctype html><title>Not found</title>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));

    await expect(createApiFetch(fetchMock)("/api/trpc/workspace.list"))
      .rejects.toThrow(/HTTP 404, text\/html.*Not found/);
  });

  it("passes JSON tRPC responses through unchanged", async () => {
    const expected = new Response('{"result":{"data":{"json":[]}}}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(expected);

    await expect(createApiFetch(fetchMock)("/api/trpc/workspace.list")).resolves.toBe(expected);
  });
});
