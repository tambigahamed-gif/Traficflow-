import { describe, expect, it } from "vitest";
import { APP_MODE_DETAILS, isAppMode, isNavigationVisible } from "../client/src/lib/app-mode";
import { parseOnboardingPreferences } from "../client/src/lib/onboarding-storage";

describe("TrafficFlow experience modes", () => {
  it("accepts only the three declared experience modes", () => {
    expect(isAppMode("simple")).toBe(true);
    expect(isAppMode("creator")).toBe(true);
    expect(isAppMode("professional")).toBe(true);
    expect(isAppMode("admin")).toBe(false);
    expect(isAppMode(null)).toBe(false);
  });

  it("changes navigation visibility without changing role or permissions", () => {
    expect(isNavigationVisible("simple", "dashboard")).toBe(true);
    expect(isNavigationVisible("simple", "team")).toBe(false);
    expect(isNavigationVisible("simple", "business")).toBe(false);
    expect(isNavigationVisible("creator", "analytics")).toBe(true);
    expect(isNavigationVisible("creator", "team")).toBe(false);
    expect(isNavigationVisible("creator", "intelligence")).toBe(true);
    expect(isNavigationVisible("creator", "business")).toBe(false);
    expect(isNavigationVisible("professional", "team")).toBe(true);
    expect(isNavigationVisible("professional", "business")).toBe(true);
    expect(isNavigationVisible("professional", "intelligence")).toBe(true);
    expect(APP_MODE_DETAILS.professional.navigation).toContain("billing");
  });

  it("rejects malformed onboarding preferences and reads valid local preferences", () => {
    expect(parseOnboardingPreferences(null)).toBeNull();
    expect(parseOnboardingPreferences("not-json")).toBeNull();
    expect(parseOnboardingPreferences(JSON.stringify({ mode: "owner" }))).toBeNull();
    expect(parseOnboardingPreferences(JSON.stringify({
      mode: "creator",
      activity: "Studio photo",
      goals: ["Créer du contenu"],
      platforms: ["Instagram", "LinkedIn"],
      completedAt: "2026-11-01T10:00:00.000Z",
    }))).toEqual({
      mode: "creator",
      activity: "Studio photo",
      goals: ["Créer du contenu"],
      platforms: ["Instagram", "LinkedIn"],
      completedAt: "2026-11-01T10:00:00.000Z",
    });
  });
});
