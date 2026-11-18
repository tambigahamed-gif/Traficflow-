import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOnboardingPreferences } from "../client/src/lib/onboarding-storage";
import { SOCIAL_OAUTH_PROVIDERS } from "./integrations/social-oauth";
import { isRetiredSocialPlatform, isSupportedSocialPlatform, SOCIAL_PLATFORMS } from "../shared/social-platforms";

const migration = readFileSync("supabase/migrations/0013_retire_messenger.sql", "utf8");

describe("retired social platform: Messenger", () => {
  it("lists only the seven current platforms and excludes Messenger from OAuth", () => {
    expect(SOCIAL_PLATFORMS).toEqual([
      "Instagram", "Facebook", "TikTok", "YouTube", "Threads", "X", "LinkedIn",
    ]);
    expect(isSupportedSocialPlatform("Messenger")).toBe(false);
    expect(isRetiredSocialPlatform("Messenger")).toBe(true);
    expect(Object.keys(SOCIAL_OAUTH_PROVIDERS)).not.toContain("Messenger");
    expect(Object.keys(SOCIAL_OAUTH_PROVIDERS)).toContain("Facebook");
    expect(Object.keys(SOCIAL_OAUTH_PROVIDERS)).toContain("Instagram");
  });

  it("filters Messenger from old onboarding preferences but preserves other preferences", () => {
    const parsed = parseOnboardingPreferences(JSON.stringify({
      mode: "professional",
      activity: "Agence",
      goals: ["Organiser une équipe"],
      platforms: ["Instagram", "Messenger", "LinkedIn", "unknown"],
      completedAt: "2026-11-01T10:00:00.000Z",
    }));
    expect(parsed?.platforms).toEqual(["Instagram", "LinkedIn"]);
    expect(parsed?.mode).toBe("professional");
    expect(parsed?.activity).toBe("Agence");
  });

  it("contains idempotent, non-destructive database guards for new accounts and posts", () => {
    expect(migration).toMatch(/create or replace function private\.trafficflow_block_retired_messenger/i);
    expect(migration).toMatch(/before insert or update of platform on public\.social_accounts/i);
    expect(migration).toMatch(/before insert or update of social_account_id on public\.posts/i);
    expect(migration).toMatch(/before insert or update of provider_code on public\.social_connections/i);
    expect(migration).toMatch(/before insert or update of social_account_id on public\.tasks/i);
    expect(migration).toMatch(/before insert or update of social_account_id on public\.account_assignments/i);
    expect(migration).toMatch(/before insert or update of social_account_id on public\.ai_assistants/i);
    expect(migration).toMatch(/before insert or update of social_account_id on public\.media_account_links/i);
    expect(migration).toMatch(/update public\.social_platforms[\s\S]*where code = 'messenger'/i);
    expect(migration).toMatch(/notify pgrst, 'reload schema'/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.social_accounts|delete\s+from\s+public\.posts|truncate\s+table|drop\s+table/i);
  });
});
