/**
 * Source unique des forfaits côté interface (affichage, comparatif, landing).
 * Les limites FAISANT FOI sont celles de la table `subscription_plans`
 * (migration 0012) et sont appliquées par des triggers SQL : ce fichier ne sert
 * qu'à l'affichage et aux tests de cohérence. `null` = illimité.
 */
export type PlanCode = "free" | "standard" | "pro" | "business";

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  priceUsd: number;
  socialAccounts: number;
  linkPages: number | null;
  virtualAssistants: number;
  members: number;
  scheduledPosts: number;
  aiMessages: number;
  automations: number;
  support: string;
  features: string[];
};

export const TRIAL_DAYS = 7;
export const PAYMENT_GRACE_DAYS = 7;
export const DISPLAY_CURRENCY = "USD";

export const PLANS: readonly PlanDefinition[] = [
  { code: "free", name: "Free", priceUsd: 0, socialAccounts: 3, linkPages: 1, virtualAssistants: 0, members: 1, scheduledPosts: 20, aiMessages: 20, automations: 0,
    support: "E-mail", features: ["Analytics de base", "Assistant IA avec limites"] },
  { code: "standard", name: "Standard", priceUsd: 9, socialAccounts: 10, linkPages: 5, virtualAssistants: 2, members: 3, scheduledPosts: 100, aiMessages: 250, automations: 5,
    support: "E-mail", features: ["Analytics de base", "Assistant IA", "Automatisations", "Rôles et permissions"] },
  { code: "pro", name: "Pro", priceUsd: 29, socialAccounts: 50, linkPages: 20, virtualAssistants: 9, members: 10, scheduledPosts: 500, aiMessages: 750, automations: 25,
    support: "E-mail prioritaire", features: ["Analytics avancées", "Assistant IA avancé", "Automatisations avancées", "Rôles et permissions"] },
  { code: "business", name: "Business", priceUsd: 99, socialAccounts: 150, linkPages: null, virtualAssistants: 29, members: 30, scheduledPosts: 2000, aiMessages: 2000, automations: 100,
    support: "Prioritaire", features: ["Analytics avancées et équipe", "Assistant IA avancé", "Automatisations avancées", "Permissions avancées"] },
] as const;

export const getPlan = (code: string): PlanDefinition | undefined => PLANS.find(plan => plan.code === code);

/** Messages affichés quand une limite serveur est atteinte (codes levés par les triggers SQL). */
export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  "plan_limit:social_accounts": "Limite de comptes sociaux atteinte pour votre forfait. Passez à un forfait supérieur.",
  "plan_limit:link_pages": "Limite de Link Pages atteinte pour votre forfait. Passez à un forfait supérieur.",
  "plan_limit:scheduled_posts": "Limite de publications programmées atteinte pour votre forfait. Passez à un forfait supérieur.",
  "plan_limit:va_members": "Limite de membres atteinte pour votre forfait. Passez à un forfait supérieur.",
  "plan_limit:automations": "Limite d’automatisations atteinte pour votre forfait. Passez à un forfait supérieur.",
  "plan_limit:ai_messages": "Limite d’utilisation de l’assistant IA atteinte ce mois-ci. Consultez Abonnement pour changer de forfait.",
};

export function planLimitMessage(rawMessage: string): string | null {
  for (const [code, message] of Object.entries(PLAN_LIMIT_MESSAGES)) if (rawMessage.includes(code)) return message;
  return null;
}
