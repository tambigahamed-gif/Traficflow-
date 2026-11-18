import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AI_GENERATION_TASKS, type AiGenerationTask } from "../../shared/ai";
import { planLimitMessage } from "../../shared/plans";
import { isSupportedSocialPlatform } from "../../shared/social-platforms";
import type { TrpcContext } from "../_core/context";
import { protectedProcedure, router } from "../_core/trpc";
import { AiGenerationError, AiNotConfiguredError, generateWithAiFallback, getAiProviderStatus } from "../integrations/llm-providers";

const taskInstructions: Record<AiGenerationTask, string> = {
  idea: "Propose 5 idées de contenu concrètes avec un angle et un objectif pour chacune.",
  caption: "Rédige une légende prête à relire avec un hook, une valeur claire, un appel à l’action et des hashtags pertinents.",
  platform_variant: "Adapte le brief au format et au ton attendus sur la plateforme du compte sélectionné. Ne prétends pas connaître ses limites API non vérifiées.",
  metadata: "Prépare un titre, une description, un appel à l’action et une liste de hashtags, clairement séparés.",
  editorial_calendar: "Prépare un calendrier éditorial de 7 jours avec sujet, format suggéré et objectif. N’invente aucune date d’événement.",
  content_review: "Analyse uniquement le contenu fourni : points forts, points à clarifier et une version révisée. Ne prétends pas prédire ses performances.",
};

export const contentRouter = router({
  providers: protectedProcedure.query(() => getAiProviderStatus()),
  generateCaption: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      accountId: z.number().int().positive(),
      brief: z.string().trim().min(3).max(2000),
      task: z.enum(AI_GENERATION_TASKS).default("caption"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.supabase || !ctx.authId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session Supabase requise." });
      const supabase = ctx.supabase;
      const { data: account, error: accountError } = await supabase.from("social_accounts")
        .select("id,workspace_id,platform,handle,display_name,niche")
        .eq("workspace_id", input.workspaceId).eq("id", input.accountId).maybeSingle();
      if (accountError || !account) throw new TRPCError({ code: "FORBIDDEN", message: "Ce compte est introuvable ou ne vous est pas attribué." });
      if (!isSupportedSocialPlatform(account.platform)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cette plateforme est retirée; la fiche historique reste conservée." });
      }
      const [{ data: assistant }, { data: recentPosts }, { data: messagesUsed, error: quotaError }] = await Promise.all([
        supabase.from("ai_assistants").select("tone,language,style,audience,rules,permission")
          .eq("workspace_id", input.workspaceId).eq("social_account_id", input.accountId).maybeSingle(),
        supabase.from("posts").select("title,caption,status,published_at,created_at")
          .eq("workspace_id", input.workspaceId).eq("social_account_id", input.accountId)
          .in("status", ["published", "draft", "scheduled"]).order("created_at", { ascending: false }).limit(6),
        supabase.rpc("trafficflow_consume_ai_message", { p_workspace_id: input.workspaceId }),
      ]);
      if (quotaError) {
        const message = planLimitMessage(quotaError.message) ?? quotaError.message;
        throw new TRPCError({ code: "FORBIDDEN", message });
      }
      const history = (recentPosts ?? []).map((post, index) => `${index + 1}. ${post.title} [${post.status}]: ${(post.caption ?? "").slice(0, 500)}`).join("\n");
      const instructions = [
        `Tu es l’assistant de contenu de ${account.display_name} (${account.platform}, ${account.handle}).`,
        `Niche : ${account.niche}. Ton : ${assistant?.tone ?? "Authentique"}. Langue : ${assistant?.language ?? "Français"}.`,
        `Style : ${assistant?.style ?? "Clair, chaleureux et utile"}. Audience : ${assistant?.audience ?? "Communauté intéressée par la niche"}.`,
        assistant?.rules ? `Règles de l'utilisateur : ${assistant.rules}` : "",
        history ? `Quelques contenus autorisés de ce compte comme contexte (ne pas recopier) :\n${history}` : "Aucun historique disponible pour ce compte.",
        taskInstructions[input.task],
        "Ne prétends jamais publier, répondre, lire les statistiques d’une plateforme ou exécuter une action à la place de l’utilisateur. Rends une proposition que l’utilisateur doit relire.",
      ].filter(Boolean).join("\n");
      try {
        const result = await generateWithAiFallback({ system: instructions, user: input.brief });
        return { content: result.content, provider: result.provider, messagesUsed };
      } catch (error) {
        if (error instanceof AiNotConfiguredError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configurez GEMINI_API_KEY ou GROQ_API_KEY côté serveur avant d’utiliser l’assistant." });
        }
        if (error instanceof AiGenerationError) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini et Groq n’ont pas répondu. Aucun contenu n’a été enregistré; le message tenté reste compté dans le quota." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La génération a échoué. Aucun contenu n’a été enregistré; le message tenté reste compté dans le quota." });
      }
    }),
});
