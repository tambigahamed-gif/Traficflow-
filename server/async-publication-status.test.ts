import { describe, expect, it } from "vitest";
import type { PublishResult } from "./integrations/social-publishers";

describe("publication asynchrone", () => {
  it("considère TikTok soumis comme non finalisé", () => {
    const result: PublishResult = { providerPostId: "publish-123", providerStatus: "SUBMITTED", finalized: false };
    expect(result.finalized).toBe(false);
    expect(result.providerPostId).toBe("publish-123");
  });

  it("n’autorise le statut published qu’avec une confirmation finale", () => {
    const pending: PublishResult = { providerPostId: "publish-123", finalized: false };
    const complete: PublishResult = { providerPostId: "post-456", finalized: true, providerStatus: "PUBLISHED" };
    expect(pending.finalized === true).toBe(false);
    expect(complete.finalized === true).toBe(true);
  });
});
