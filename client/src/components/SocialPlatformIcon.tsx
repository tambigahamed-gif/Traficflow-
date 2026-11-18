import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
import {
  siFacebook,
  siInstagram,
  siThreads,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons";
import type { CSSProperties } from "react";
import type { SocialPlatform } from "@shared/social-platforms";

export type { SocialPlatform } from "@shared/social-platforms";

export const SOCIAL_PLATFORM_COLORS: Record<SocialPlatform, string> = {
  Instagram: `#${siInstagram.hex}`,
  Facebook: `#${siFacebook.hex}`,
  TikTok: `#${siTiktok.hex}`,
  YouTube: `#${siYoutube.hex}`,
  Threads: `#${siThreads.hex}`,
  X: `#${siX.hex}`,
  LinkedIn: "#0A66C2",
};

const SIMPLE_ICONS = {
  Instagram: siInstagram,
  Facebook: siFacebook,
  TikTok: siTiktok,
  YouTube: siYoutube,
  Threads: siThreads,
  X: siX,
} as const;

type Props = {
  platform: SocialPlatform;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** Brand marks only; surrounding text communicates availability and connection state. */
export function SocialPlatformIcon({ platform, size = 20, className, style }: Props) {
  if (platform === "LinkedIn") {
    const [width, height, , , path] = faLinkedin.icon;
    return (
      <svg
        aria-hidden="true"
        className={className}
        style={style}
        width={size}
        height={size}
        viewBox={`0 0 ${width} ${height}`}
        fill="currentColor"
        focusable="false"
      >
        <path d={Array.isArray(path) ? path[0] : path} />
      </svg>
    );
  }

  const icon = SIMPLE_ICONS[platform];
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}
