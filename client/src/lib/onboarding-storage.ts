import { isAppMode, type AppMode } from "@/lib/app-mode";
import { isSupportedSocialPlatform, SOCIAL_PLATFORMS } from "@shared/social-platforms";

export const ONBOARDING_GOALS = ["Créer du contenu", "Gagner en régularité", "Développer une audience", "Organiser une équipe", "Suivre les résultats"] as const;
export const ONBOARDING_PLATFORMS = SOCIAL_PLATFORMS;

export type OnboardingPreferences = {
  mode: AppMode;
  activity: string;
  goals: string[];
  platforms: string[];
  completedAt: string;
};

function storageKey(userId: string) {
  return `trafficflow_onboarding_v1_${encodeURIComponent(userId)}`;
}

export function parseOnboardingPreferences(value: string | null): OnboardingPreferences | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!isAppMode(record.mode) || typeof record.activity !== "string" ||
      !Array.isArray(record.goals) || !record.goals.every(item => typeof item === "string") ||
      !Array.isArray(record.platforms) || !record.platforms.every(item => typeof item === "string") ||
      typeof record.completedAt !== "string") return null;
    return {
      mode: record.mode,
      activity: record.activity,
      goals: record.goals,
      // Drop retired/unknown choices from old local preferences; other fields remain unchanged.
      platforms: record.platforms.filter((item): item is string => isSupportedSocialPlatform(item)),
      completedAt: record.completedAt,
    };
  } catch {
    return null;
  }
}

export function loadOnboardingPreferences(userId: string): OnboardingPreferences | null {
  try {
    return parseOnboardingPreferences(window.localStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

export function saveOnboardingPreferences(userId: string, preferences: OnboardingPreferences): boolean {
  try {
    const sanitized = { ...preferences, platforms: preferences.platforms.filter(isSupportedSocialPlatform) };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function isOnboardingComplete(userId: string): boolean {
  return Boolean(loadOnboardingPreferences(userId));
}
