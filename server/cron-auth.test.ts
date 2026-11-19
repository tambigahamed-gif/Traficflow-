import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./_core/cron-auth";

describe("Cron endpoint authorization", () => {
  it("accepts the exact Bearer secret", () => {
    expect(isAuthorizedCronRequest("Bearer test-secret", "test-secret")).toBe(true);
  });

  it("rejects missing, malformed, or wrong credentials", () => {
    expect(isAuthorizedCronRequest(undefined, "test-secret")).toBe(false);
    expect(isAuthorizedCronRequest("", "test-secret")).toBe(false);
    expect(isAuthorizedCronRequest("Basic test-secret", "test-secret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer wrong", "test-secret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer test-secret ", "test-secret")).toBe(false);
  });

  it("rejects an empty configured secret", () => {
    expect(isAuthorizedCronRequest("Bearer test-secret", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer test-secret", undefined)).toBe(false);
  });
});
