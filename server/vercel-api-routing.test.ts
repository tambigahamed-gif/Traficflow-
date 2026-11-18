import { describe, expect, it } from "vitest";
import { restoreExpressApiUrl } from "./vercel/routing";

describe("Vercel API URL restoration", () => {
  it("restores a health route from the rewrite path", () => {
    expect(restoreExpressApiUrl("/api?path=health")).toBe("/api/health");
  });

  it("preserves tRPC query parameters while removing the rewrite marker", () => {
    const input = encodeURIComponent(JSON.stringify({ "0": { json: null } }));
    expect(restoreExpressApiUrl(`/api?path=trpc/workspace.list&batch=1&input=${input}`)).toBe(
      `/api/trpc/workspace.list?batch=1&input=${input}`,
    );
  });

  it("returns null when no Vercel rewrite marker exists", () => {
    expect(restoreExpressApiUrl("/api/health?check=1")).toBeNull();
    expect(restoreExpressApiUrl(undefined)).toBeNull();
  });
});
