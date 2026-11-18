import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { planLimitMessage } from "../../shared/plans";
import type { Json } from "../../shared/database.types";
import { aiAssistants, media, posts, socialAccounts, users } from "../../drizzle/schema";
import { getDb } from "../db";
import type { TrpcContext } from "../_core/context";
import { protectedProcedure, router } from "../_core/trpc";

const workspaceId = z.string().uuid();
function requireSupabase(ctx: TrpcContext) {
  if (!ctx.supabase) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session Supabase requise." });
  return ctx.supabase;
}
function throwRpc(error: { message: string } | null) {
  if (!error) return;
  throw new TRPCError({ code: "BAD_REQUEST", message: planLimitMessage(error.message) ?? error.message });
}

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_get_my_workspaces");
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return data ?? [];
  }),
  create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(100) })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_workspace", { p_name: input.name });
    if (error) throwRpc(error);
    return { id: data };
  }),
  rename: protectedProcedure.input(z.object({ workspaceId, name: z.string().trim().min(1).max(100) })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).from("workspaces").update({ name: input.name }).eq("id", input.workspaceId).select("id").maybeSingle();
    if (error || !data) throw new TRPCError({ code: "FORBIDDEN", message: error?.message ?? "Workspace introuvable ou accès refusé." });
    return { success: true };
  }),
  touch: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_touch_membership");
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return { success: true };
  }),
  invite: protectedProcedure.input(z.object({
    workspaceId, email: z.string().trim().email().max(320), role: z.enum(["admin", "manager", "va"]),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/), permissions: z.record(z.string(), z.boolean()),
  })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_invitation", {
      p_workspace_id: input.workspaceId, p_email: input.email, p_role: input.role,
      p_token_hash: input.tokenHash, p_permissions: input.permissions,
    });
    if (error) throwRpc(error);
    return { id: data };
  }),
  setMember: protectedProcedure.input(z.object({
    workspaceId, userId: z.string().uuid(), role: z.enum(["admin", "manager", "va"]),
    status: z.enum(["active", "suspended"]), permissions: z.record(z.string(), z.boolean()),
  })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_set_member", {
      p_workspace_id: input.workspaceId, p_user_id: input.userId, p_role: input.role,
      p_status: input.status, p_permissions: input.permissions,
    });
    throwRpc(error);
    return { success: true };
  }),
  updateMemberRole: protectedProcedure.input(z.object({ workspaceId, userId: z.string().uuid(), role: z.enum(["admin", "manager", "va"]) })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_update_member_role", { p_workspace_id: input.workspaceId, p_user_id: input.userId, p_role: input.role });
    throwRpc(error);
    return { success: true };
  }),
  removeMember: protectedProcedure.input(z.object({ workspaceId, userId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_remove_member", { p_workspace_id: input.workspaceId, p_user_id: input.userId });
    throwRpc(error);
    return { success: true };
  }),
  revokeInvitation: protectedProcedure.input(z.object({ workspaceId, invitationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_revoke_invitation", { p_workspace_id: input.workspaceId, p_invitation_id: input.invitationId });
    throwRpc(error);
    return { success: true };
  }),
  assignAccount: protectedProcedure.input(z.object({
    workspaceId, accountId: z.number().int().positive(), userId: z.string().uuid(),
    permissions: z.record(z.string(), z.boolean()),
  })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_set_assignment", {
      p_workspace_id: input.workspaceId, p_social_account_id: input.accountId,
      p_user_id: input.userId, p_permissions: input.permissions,
    });
    throwRpc(error);
    return { success: true };
  }),
  unassignAccount: protectedProcedure.input(z.object({ workspaceId, accountId: z.number().int().positive(), userId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_delete_assignment", {
      p_workspace_id: input.workspaceId, p_social_account_id: input.accountId, p_user_id: input.userId,
    });
    throwRpc(error);
    return { success: true };
  }),
  createTask: protectedProcedure.input(z.object({
    workspaceId, title: z.string().trim().min(1).max(200), description: z.string().max(5000).default(""),
    assigneeId: z.string().uuid().nullable().optional(), accountId: z.number().int().positive().nullable().optional(),
    postId: z.number().int().positive().nullable().optional(), dueAt: z.string().datetime().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_task", {
      p_workspace_id: input.workspaceId, p_title: input.title, p_description: input.description,
      p_assigned_to: (input.assigneeId ?? null) as unknown as string,
      p_social_account_id: (input.accountId ?? null) as unknown as number,
      p_post_id: (input.postId ?? null) as unknown as number,
      p_due_at: (input.dueAt ?? null) as unknown as string,
    });
    throwRpc(error);
    return { id: data };
  }),
  updateTaskStatus: protectedProcedure.input(z.object({ workspaceId, taskId: z.string().uuid(), status: z.enum(["todo", "in_progress", "done", "canceled"]) })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_update_task_status", { p_workspace_id: input.workspaceId, p_task_id: input.taskId, p_status: input.status });
    throwRpc(error);
    return { success: true };
  }),
  requestPlanChange: protectedProcedure.input(z.object({ workspaceId, planCode: z.enum(["standard", "pro", "business"]) })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_request_plan_change", { p_workspace_id: input.workspaceId, p_plan_code: input.planCode });
    throwRpc(error);
    return { id: data, status: "awaiting_payment_provider" as const };
  }),
  createWorkflow: protectedProcedure.input(z.object({
    workspaceId, name: z.string().trim().min(1).max(120), triggerType: z.enum(["post_published", "post_failed", "task_done", "new_comment", "analytics_updated", "manual"]),
    condition: z.record(z.string(), z.any()).default({}), actionType: z.enum(["notify_va", "notify_manager", "suggest_reply", "refresh_analytics", "manual"]),
    actionConfig: z.record(z.string(), z.any()).default({}),
  })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_workflow", {
      p_workspace_id: input.workspaceId, p_name: input.name, p_trigger_type: input.triggerType,
      p_condition: input.condition, p_action_type: input.actionType, p_action_config: input.actionConfig,
    });
    throwRpc(error);
    return { id: data };
  }),
  setWorkflowEnabled: protectedProcedure.input(z.object({ workspaceId, workflowId: z.string().uuid(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_update_workflow", { p_workspace_id: input.workspaceId, p_workflow_id: input.workflowId, p_enabled: input.enabled });
    throwRpc(error);
    return { success: true };
  }),
});


const iso = (date: Date | null | undefined) => date ? date.toISOString() : null;

// V1 preservation is explicit and email-scoped; no OAuth/API credentials are copied.
export const legacyImportProcedure = protectedProcedure.input(z.object({ workspaceId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
  if (!ctx.supabase || !ctx.authId || !ctx.user.email) throw new TRPCError({ code: "UNAUTHORIZED", message: "Connectez-vous avec l’adresse e-mail utilisée sur TrafficFlow V1." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La base V1 n’est pas disponible dans cet environnement." });
  const { data: membership, error: membershipError } = await ctx.supabase.from("workspace_members")
    .select("role,status").eq("workspace_id", input.workspaceId).eq("user_id", ctx.authId).maybeSingle();
  if (membershipError || !membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire ou un administrateur du Workspace peut importer la V1." });
  }
  const [legacyUser] = await db.select().from(users).where(eq(users.email, ctx.user.email)).limit(1);
  if (!legacyUser) throw new TRPCError({ code: "NOT_FOUND", message: "Aucun compte V1 correspondant à cette adresse e-mail n’a été trouvé." });
  const existing = await ctx.supabase.from("legacy_imports").select("workspace_id").eq("workspace_id", input.workspaceId).maybeSingle();
  if (existing.error) throw new TRPCError({ code: "FORBIDDEN", message: existing.error.message });
  if (existing.data) return { alreadyImported: true, accounts: 0, media: 0, posts: 0 };

  const [legacyAccounts, legacyAssistants, legacyMedia, legacyPosts] = await Promise.all([
    db.select().from(socialAccounts).where(eq(socialAccounts.userId, legacyUser.id)).limit(1000),
    db.select().from(aiAssistants).where(eq(aiAssistants.userId, legacyUser.id)).limit(1000),
    db.select().from(media).where(eq(media.userId, legacyUser.id)).limit(1000),
    db.select().from(posts).where(eq(posts.userId, legacyUser.id)).limit(5000),
  ]);
  const payload = {
    accounts: legacyAccounts.map(row => ({
      id: row.id, platform: row.platform, handle: row.handle, displayName: row.displayName, niche: row.niche,
      avatarUrl: row.avatarUrl, followers: row.followers, engagementRate: row.engagementRate,
      connectionStatus: row.connectionStatus, isActive: row.isActive, connectedAt: row.connectedAt.toISOString(),
    })),
    assistants: legacyAssistants.map(row => ({ socialAccountId: row.socialAccountId, tone: row.tone, language: row.language, style: row.style, audience: row.audience, rules: row.rules ?? "", permission: row.permission })),
    media: legacyMedia.map(row => ({ id: row.id, title: row.title, mediaType: row.mediaType, url: row.url, tags: row.tags ?? "", createdAt: row.createdAt.toISOString() })),
    posts: legacyPosts.map(row => ({
      id: row.id, socialAccountId: row.socialAccountId, mediaId: row.mediaId, title: row.title, caption: row.caption ?? "",
      hashtags: row.hashtags ?? "", cta: row.cta ?? "", status: row.status, scheduledAt: iso(row.scheduledAt),
      publishedAt: iso(row.publishedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    })),
  } as unknown as Json;
  const { data, error } = await ctx.supabase.rpc("trafficflow_import_v1", { p_workspace_id: input.workspaceId, p_payload: payload });
  if (error) {
    const message = error.message.includes("duplicate key") || error.message.includes("already exists")
      ? "Certaines données V1 sont déjà présentes. Aucune donnée n’a été importée partiellement."
      : error.message;
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  const summary = data as { accounts?: number; media?: number; posts?: number; already_imported?: boolean };
  return { alreadyImported: Boolean(summary.already_imported), accounts: summary.accounts ?? 0, media: summary.media ?? 0, posts: summary.posts ?? 0 };
});

export const legacyImportRouter = router({ importLegacy: legacyImportProcedure });
