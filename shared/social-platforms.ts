export const SOCIAL_PLATFORMS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "YouTube",
  "Threads",
  "X",
  "LinkedIn",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Historical account rows are preserved but no longer offered as active integrations. */
export const RETIRED_SOCIAL_PLATFORMS = ["Messenger"] as const;
export type RetiredSocialPlatform = (typeof RETIRED_SOCIAL_PLATFORMS)[number];

export function isSupportedSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function isRetiredSocialPlatform(value: string): value is RetiredSocialPlatform {
  return (RETIRED_SOCIAL_PLATFORMS as readonly string[]).includes(value);
}
