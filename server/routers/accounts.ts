import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isSupportedSocialPlatform, SOCIAL_PLATFORMS } from "../../shared/social-platforms";
import { planLimitMessage } from "../../shared/plans";
import type { TrpcContext } from "../_core/context";
import { protectedProcedure, router } from "../_core/trpc";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });
function requireSupabase(ctx: TrpcContext) {
  if (!ctx.supabase) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session Supabase requise." });
  return ctx.supabase;
}

async function assertSupportedAccount(ctx: TrpcContext, workspaceId: string, accountId: number) {
  const { data, error } = await requireSupabase(ctx).from("social_accounts")
    .select("platform").eq("workspace_id", workspaceId).eq("id", accountId).maybeSingle();
  if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: "Compte introuvable ou accès refusé." });
  if (!isSupportedSocialPlatform(data.platform)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cette plateforme est retirée; la fiche historique reste conservée." });
  }
}

export const accountsRouter = router({
  list: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).from("social_accounts").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false });
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return data ?? [];
  }),
  assistants: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).from("ai_assistants").select("*").eq("workspace_id", input.workspaceId);
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return data ?? [];
  }),
  add: protectedProcedure.input(workspaceInput.extend({
    platform: z.enum(SOCIAL_PLATFORMS),
    handle: z.string().trim().min(2).max(120),
    displayName: z.string().trim().min(2).max(160),
    niche: z.string().trim().max(120).default("Créateur"),
  })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_social_account", {
      p_workspace_id: input.workspaceId, p_platform: input.platform, p_handle: input.handle,
      p_display_name: input.displayName, p_niche: input.niche,
    });
    if (error) {
      const message = planLimitMessage(error.message) ?? error.message;
      throw new TRPCError({ code: "BAD_REQUEST", message });
    }
    return { id: data };
  }),
  setActive: protectedProcedure.input(workspaceInput.extend({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
    await assertSupportedAccount(ctx, input.workspaceId, input.id);
    const { data, error } = await requireSupabase(ctx).from("social_accounts").update({ is_active: input.active }).eq("workspace_id", input.workspaceId).eq("id", input.id).select("id").maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: error?.message ?? "Compte introuvable ou accès refusé." });
    return { success: true };
  }),
  remove: protectedProcedure.input(workspaceInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).from("social_accounts").delete().eq("workspace_id", input.workspaceId).eq("id", input.id).select("id").maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: error?.message ?? "Compte introuvable ou accès refusé." });
    return { success: true };
  }),
  updateAssistant: protectedProcedure.input(workspaceInput.extend({
    accountId: z.number().int().positive(),
    tone: z.string().trim().min(1).max(80), language: z.string().trim().min(1).max(48),
    style: z.string().trim().min(1).max(160), audience: z.string().trim().min(1).max(255),
    rules: z.string().max(4000), permission: z.enum(["suggestions", "preparation", "automation", "replies"]),
  })).mutation(async ({ ctx, input }) => {
    await assertSupportedAccount(ctx, input.workspaceId, input.accountId);
    const { error } = await requireSupabase(ctx).rpc("trafficflow_save_assistant", {
      p_workspace_id: input.workspaceId, p_social_account_id: input.accountId, p_tone: input.tone,
      p_language: input.language, p_style: input.style, p_audience: input.audience,
      p_rules: input.rules, p_permission: input.permission,
    });
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return { success: true };
  }),
  assign: protectedProcedure.input(workspaceInput.extend({
    accountId: z.number().int().positive(), userId: z.string().uuid(), permissions: z.record(z.string(), z.boolean()),
  })).mutation(async ({ ctx, input }) => {
    await assertSupportedAccount(ctx, input.workspaceId, input.accountId);
    const { error } = await requireSupabase(ctx).rpc("trafficflow_set_assignment", {
      p_workspace_id: input.workspaceId, p_social_account_id: input.accountId,
      p_user_id: input.userId, p_permissions: input.permissions,
    });
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return { success: true };
  }),
});
