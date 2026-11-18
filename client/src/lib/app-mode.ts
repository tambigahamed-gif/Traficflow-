export const APP_MODES = ["simple", "creator", "professional"] as const;

export type AppMode = (typeof APP_MODES)[number];
export type AppNavigationId =
  | "dashboard"
  | "accounts"
  | "content"
  | "link-pages"
  | "calendar"
  | "posts"
  | "interactions"
  | "assistants"
  | "analytics"
  | "intelligence"
  | "business"
  | "automations"
  | "team"
  | "notifications"
  | "billing"
  | "settings";

export const APP_MODE_DETAILS: Record<
  AppMode,
  { label: string; summary: string; audience: string; navigation: readonly AppNavigationId[] }
> = {
  simple: {
    label: "Simple",
    summary: "L’essentiel pour préparer vos contenus et rester régulier, sans surcharger votre espace.",
    audience: "Débutants, indépendants et petites activités",
    navigation: ["dashboard", "accounts", "content", "calendar", "posts", "assistants", "link-pages", "notifications", "billing", "settings"],
  },
  creator: {
    label: "Créateur",
    summary: "Un espace de création pour organiser plusieurs comptes, contenus, calendriers et statistiques disponibles.",
    audience: "Créateurs, influenceurs et responsables de plusieurs comptes",
    navigation: ["dashboard", "accounts", "content", "link-pages", "calendar", "posts", "interactions", "assistants", "analytics", "intelligence", "automations", "notifications", "billing", "settings"],
  },
  professional: {
    label: "Professionnel",
    summary: "Les outils d’équipe et de suivi sont réunis pour coordonner un Workspace multi-comptes.",
    audience: "Équipes, agences et entreprises",
    navigation: ["dashboard", "accounts", "content", "link-pages", "calendar", "posts", "interactions", "assistants", "analytics", "intelligence", "automations", "team", "business", "notifications", "billing", "settings"],
  },
};

export function isAppMode(value: unknown): value is AppMode {
  return typeof value === "string" && APP_MODES.some(mode => mode === value);
}

/** UI organization only. Backend authorization, RLS and plan quotas are unchanged. */
export function isNavigationVisible(mode: AppMode, id: AppNavigationId): boolean {
  return APP_MODE_DETAILS[mode].navigation.includes(id);
}
