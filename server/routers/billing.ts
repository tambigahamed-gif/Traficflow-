import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { planLimitMessage } from "../../shared/plans";
import type { TrpcContext } from "../_core/context";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { SASPAY_ADAPTER_IMPLEMENTED, createSaspayCheckout, getSaspayConfigStatus } from "../integrations/saspay";

const workspaceId = z.string().uuid();
function requireSupabase(ctx: TrpcContext) {
  if (!ctx.supabase) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session Supabase requise." });
  return ctx.supabase;
}

export const billingRouter = router({
  plans: publicProcedure.query(async ({ ctx }) => {
    // Lecture via la session si disponible ; sinon l'interface utilise shared/plans.ts.
    if (!ctx.supabase) return [];
    const { data, error } = await ctx.supabase.from("subscription_plans").select("*").eq("is_public", true).order("sort_order");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de charger les forfaits." });
    return data ?? [];
  }),
  usage: protectedProcedure.input(z.object({ workspaceId })).query(async ({ ctx, input }) => {
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_get_usage_v3", { p_workspace_id: input.workspaceId });
    if (error) throw new TRPCError({ code: "FORBIDDEN", message: error.message });
    return data?.[0] ?? null;
  }),
  invoices: protectedProcedure.input(z.object({ workspaceId })).query(async ({ ctx, input }) => {
    const [invoices, transactions] = await Promise.all([
      requireSupabase(ctx).from("invoices").select("*").eq("workspace_id", input.workspaceId).order("issued_at", { ascending: false }).limit(100),
      requireSupabase(ctx).from("payment_transactions").select("id,plan_code,amount_usd,currency,provider,reference,status,created_at,confirmed_at").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(100),
    ]);
    if (invoices.error || transactions.error) throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé." });
    return { invoices: invoices.data ?? [], transactions: transactions.data ?? [] };
  }),
  paymentProviders: protectedProcedure.query(() => ({
    saspay: { configured: getSaspayConfigStatus().configured, operational: getSaspayConfigStatus().configured && SASPAY_ADAPTER_IMPLEMENTED },
    binance_pay: { configured: false, operational: false },
  })),
  checkout: protectedProcedure.input(z.object({
    workspaceId, planCode: z.enum(["standard", "pro", "business"]), provider: z.literal("saspay").default("saspay"),
  })).mutation(async ({ ctx, input }) => {
    // 1. Refuser avant de créer quoi que ce soit si le fournisseur n'est pas opérationnel.
    if (!getSaspayConfigStatus().configured || !SASPAY_ADAPTER_IMPLEMENTED) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le paiement n’est pas encore activé. Aucun montant n’a été débité et votre forfait reste inchangé." });
    }
    // 2. Montant et référence créés côté serveur, depuis la base.
    const { data, error } = await requireSupabase(ctx).rpc("trafficflow_create_payment", {
      p_workspace_id: input.workspaceId, p_plan_code: input.planCode, p_provider: input.provider,
    });
    if (error || !data?.[0]) throw new TRPCError({ code: "FORBIDDEN", message: planLimitMessage(error?.message ?? "") ?? "Seul le propriétaire peut souscrire." });
    const tx = data[0];
    try {
      const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
      const result = await createSaspayCheckout({ reference: tx.reference, amountUsd: Number(tx.amount_usd), planCode: input.planCode, returnUrl: `${appUrl}/abonnement?ref=${encodeURIComponent(tx.reference)}` });
      return { reference: tx.reference, redirectUrl: result.redirectUrl };
    } catch (cause) {
      console.error("[Billing] checkout failed:", cause instanceof Error ? cause.message : "unknown");
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Le fournisseur de paiement n’a pas répondu. Réessayez plus tard." });
    }
  }),
  cancel: protectedProcedure.input(z.object({ workspaceId })).mutation(async ({ ctx, input }) => {
    const { error } = await requireSupabase(ctx).rpc("trafficflow_cancel_subscription", { p_workspace_id: input.workspaceId });
    if (error) throw new TRPCError({ code: "BAD_REQUEST", message: "Aucun abonnement payant actif à annuler, ou accès refusé." });
    return { success: true };
  }),
});
