import { createClient } from "@supabase/supabase-js";
import type { Database } from "@shared/database.types";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl) &&
  Boolean(publishableKey) &&
  !/service[_-]?role|sb_secret_/i.test(publishableKey);

const safeUrl = supabaseConfigured ? projectUrl : "https://missing-config.supabase.co";
const safeKey = supabaseConfigured ? publishableKey : "missing-public-key";

export const supabase = createClient<Database>(safeUrl, safeKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    flowType: "pkce",
  },
});

export type TrafficWorkspace = Database["public"]["Functions"]["trafficflow_get_my_workspaces"]["Returns"][number];
export type WorkspaceRole = "owner" | "admin" | "manager" | "va";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
