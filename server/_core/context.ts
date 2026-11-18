import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../shared/database.types";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  authId: string | null;
  supabase: SupabaseClient<Database> | null;
};

function getBearerToken(req: CreateExpressContextOptions["req"]): string | null {
  const value = req.headers.authorization;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const base: TrpcContext = { req: opts.req, res: opts.res, user: null, authId: null, supabase: null };
  const token = getBearerToken(opts.req);
  const projectUrl = process.env.VITE_SUPABASE_URL ?? "";
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!token || !projectUrl || !publishableKey || /service[_-]?role|sb_secret_/i.test(publishableKey)) return base;

  try {
    const client = createClient<Database>(projectUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return base;

    const userId = data.user.id;
    const rawName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
    const name = typeof rawName === "string" ? rawName : null;
    const email = data.user.email ?? null;
    let localUser = await getUserByOpenId(userId);
    if (!localUser) {
      await upsertUser({ openId: userId, name, email, loginMethod: "supabase", lastSignedIn: new Date() });
      localUser = await getUserByOpenId(userId);
    }
    if (!localUser) {
      // Some deployed stages may have Supabase but no legacy MySQL. Keep Supabase-authenticated
      // AI/API procedures usable, while retired V1 SQL routers continue to return no data.
      const now = new Date();
      localUser = {
        id: 0,
        openId: userId,
        name,
        email,
        loginMethod: "supabase",
        role: "user",
        createdAt: data.user.created_at ? new Date(data.user.created_at) : now,
        updatedAt: now,
        lastSignedIn: data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at) : now,
      };
    }
    return { ...base, user: localUser, authId: userId, supabase: client };
  } catch (error) {
    console.warn("[Supabase Auth] Unable to verify bearer token:", error instanceof Error ? error.message : "unknown error");
    return base;
  }
}
