import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "../_core/context";
import { protectedProcedure, router } from "../_core/trpc";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });
function requireSupabase(ctx: TrpcContext) {
  if (!ctx.supabase || !ctx.authId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session Supabase requise." });
  return ctx.supabase;
}

export const approvalsRouter = router({
  list: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx)
      .from("post_approval_requests")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: "Impossible de lire la file d’approbation avec vos droits actuels." });
    return data ?? [];
  }),

  submit: protectedProcedure.input(workspaceInput.extend({
    postId: z.number().int().positive(),
    scheduledAt: z.string().datetime(),
    requestNote: z.string().trim().max(2000).default(""),
  })).mutation(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_submit_post_for_approval", {
      p_workspace_id: input.workspaceId,
      p_post_id: input.postId,
      p_scheduled_at: input.scheduledAt,
      p_request_note: input.requestNote,
    });
    if (error || !data) {
      const message = error?.message ?? "La demande n’a pas pu être créée.";
      throw new TRPCError({
        code: message.includes("business_plan_required") ? "PRECONDITION_FAILED" : message.includes("permission_denied") ? "FORBIDDEN" : "BAD_REQUEST",
        message: message.includes("business_plan_required") ? "Le circuit d’approbation préalable est réservé au forfait Business." : message.includes("permission_denied") ? "Vous n’avez pas les droits pour proposer ce contenu à la programmation." : message.includes("post_must_be_draft") ? "Seul un brouillon peut être soumis à l’approbation." : "La demande d’approbation a échoué. Vérifiez le brouillon et la date choisie.",
      });
    }
    return { requestId: data };
  }),

  decide: protectedProcedure.input(workspaceInput.extend({
    requestId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    decisionNote: z.string().trim().max(2000).default(""),
  })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_decide_post_approval", {
      p_workspace_id: input.workspaceId,
      p_request_id: input.requestId,
      p_decision: input.decision,
      p_decision_note: input.decisionNote,
    });
    if (error) {
      const message = error.message;
      throw new TRPCError({
        code: message.includes("permission_denied") || message.includes("requester_cannot_approve_own_post") ? "FORBIDDEN" : "BAD_REQUEST",
        message: message.includes("requester_cannot_approve_own_post") ? "La personne qui a soumis la demande ne peut pas l’approuver." : message.includes("approval_post_changed_since_submission") ? "Le brouillon a changé depuis la demande. Soumettez-le à nouveau pour validation." : message.includes("permission_denied") ? "Seuls les propriétaires, administrateurs ou gestionnaires peuvent décider." : message.includes("approval_request_already_decided") ? "Cette demande a déjà été traitée." : "La décision n’a pas pu être enregistrée.",
      });
    }
    return { success: true };
  }),
});
