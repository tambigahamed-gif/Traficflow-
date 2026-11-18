import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../shared/database.types";

/**
 * Client service_role : serveur uniquement (webhooks, tâches planifiées).
 * Ne jamais l'utiliser pour une requête déclenchée par un utilisateur.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  const url = process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
