/**
 * Frontière d'intégration SASPay.
 *
 * AUCUN endpoint ni schéma de signature n'est supposé ici : le contrat officiel
 * SASPay (création de paiement, vérification serveur, signature des webhooks,
 * sandbox) doit être fourni par le propriétaire. Tant que ce n'est pas fait,
 * la création de paiement et les webhooks sont REFUSÉS (jamais simulés).
 * Les secrets restent côté serveur.
 */

export type SaspayConfigStatus = { configured: boolean; missing: string[] };

const requiredServerVariables = ["SASPAY_API_KEY", "SASPAY_API_SECRET", "SASPAY_WEBHOOK_SECRET", "SASPAY_BASE_URL"] as const;

export function getSaspayConfigStatus(env: NodeJS.ProcessEnv = process.env): SaspayConfigStatus {
  const missing = requiredServerVariables.filter(name => !env[name]?.trim());
  return { configured: missing.length === 0, missing };
}

export function assertSaspayConfigured(env: NodeJS.ProcessEnv = process.env): void {
  const status = getSaspayConfigStatus(env);
  if (!status.configured) throw new Error(`Configuration requise pour SASPay : ${status.missing.join(", ")}`);
}

/** Vrai uniquement quand l'adaptateur officiel (ci-dessous) est implémenté ET validé. */
export const SASPAY_ADAPTER_IMPLEMENTED = false;

export type CheckoutRequest = { reference: string; amountUsd: number; planCode: string; returnUrl: string };
export type CheckoutResult = { redirectUrl: string; providerTransactionId?: string };

export async function createSaspayCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
  assertSaspayConfigured();
  if (!SASPAY_ADAPTER_IMPLEMENTED) throw new Error("SASPAY_ADAPTER_NOT_IMPLEMENTED");
  throw new Error("SASPAY_ADAPTER_NOT_IMPLEMENTED");
}

export type VerifiedWebhook = {
  eventId: string; reference: string; providerTransactionId: string; amountUsd: number; success: boolean; reason?: string;
};

/** Doit authentifier la requête selon le mécanisme officiel ; retourne null si la signature est invalide. */
export function verifySaspayWebhook(_rawBody: Buffer, _headers: Record<string, string | string[] | undefined>): VerifiedWebhook | null {
  // Refus par défaut : aucune notification n'est acceptée sans vérification officielle implémentée.
  return null;
}
