import { describe, expect, it } from "vitest";
import { extractLinkedInPostId, validateLinkedInMedia, validateXMedia } from "./integrations/social-publishers";
import { retryDelayMinutes, shouldRetryPublication } from "./workers/publication-worker";

describe("publication retry policy", () => {
  it("retries only bounded temporary provider and network failures", () => {
    expect(shouldRetryPublication(new Error("provider_503:busy"), 1)).toBe(true);
    expect(shouldRetryPublication(new Error("fetch failed"), 2)).toBe(true);
    expect(shouldRetryPublication(new Error("provider_400:invalid"), 1)).toBe(false);
    expect(shouldRetryPublication(new Error("timeout"), 3)).toBe(false);
  });

  it("uses exponential backoff capped at 60 minutes", () => {
    expect(retryDelayMinutes(1)).toBe(1);
    expect(retryDelayMinutes(2)).toBe(2);
    expect(retryDelayMinutes(3)).toBe(4);
    expect(retryDelayMinutes(8)).toBe(60);
  });
});

describe("LinkedIn publication guards", () => {
  it("refuses media until the official upload flow exists", () => {
    expect(() => validateLinkedInMedia("https://cdn.example/media.mp4", "video")).toThrow(/upload/i);
    expect(() => validateLinkedInMedia("https://cdn.example/media.jpg", "image")).not.toThrow();
    expect(() => validateLinkedInMedia(null, null)).not.toThrow();
  });

  it("refuse les médias X sans accès média explicitement configuré", () => {
    expect(() => validateXMedia("https://cdn.example/media.jpg")).toThrow(/accès.*crédits/i);
    expect(() => validateXMedia(null)).not.toThrow();
  });

  it("extracts the provider id from x-restli-id first", () => {
    const headers = new Headers({ "x-restli-id": "urn:li:share:123" });
    expect(extractLinkedInPostId(headers, { id: "fallback" })).toBe("urn:li:share:123");
    expect(extractLinkedInPostId(new Headers(), { id: "fallback" })).toBe("fallback");
  });
});
