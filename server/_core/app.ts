import "dotenv/config";
import { randomUUID } from "node:crypto";
import express, { type Application, type NextFunction, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { verifySaspayWebhook } from "../integrations/saspay";
import { refreshExpiringSocialTokens, registerSocialOAuthRoutes } from "../integrations/social-oauth";
import { runAnalyticsCollectors } from "../integrations/social-analytics";
import { runPublicationWorker } from "../workers/publication-worker";
import { isAuthorizedCronRequest } from "./cron-auth";

/**
 * Application Express partagée par le serveur local et la fonction Vercel.
 *
 * IMPORTANT : ce fichier ne doit JAMAIS importer `./vite` (ni `vite.config`).
 * Vite entraîne @tailwindcss/vite et lightningcss (binaire natif) dans la
 * fonction serverless, ce qui provoquait `Cannot find module
 * '../lightningcss.linux-x64-gnu.node'`.
 */
type AppOptions = {
  /** Branche le frontend (Vite en dev, fichiers statiques en prod) avant le gestionnaire d'erreurs. */
  attachFrontend?: (app: Application) => Promise<void> | void;
};

export async function createApp({ attachFrontend }: AppOptions = {}): Promise<Application> {
  const app = express();

  // Webhook SASPay : corps BRUT requis pour vérifier la signature (avant express.json).
  app.post("/api/webhooks/saspay", express.raw({ type: "*/*", limit: "1mb" }), async (req: Request, res: Response) => {
    const admin = getSupabaseAdmin();
    if (!admin) return void res.status(503).json({ error: "not_configured" });
    const verified = verifySaspayWebhook(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), req.headers);
    // Refus par défaut : sans signature officielle vérifiée, aucun abonnement n'est jamais activé.
    if (!verified) return void res.status(401).json({ error: "invalid_signature" });
    const { data, error } = await admin.rpc("trafficflow_apply_payment_result", {
      p_provider: "saspay", p_event_id: verified.eventId, p_reference: verified.reference,
      p_provider_transaction_id: verified.providerTransactionId, p_amount_usd: verified.amountUsd,
      p_success: verified.success, p_reason: verified.reason,
    });
    if (error) { console.error("[Billing] webhook apply failed:", error.message); return void res.status(500).json({ error: "apply_failed" }); }
    res.status(200).json({ ok: true, outcome: data });
  });

  // Tâche planifiée externe : renouvellements échus, période de grâce, expirations.
  app.get("/api/cron/subscriptions", async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req.get("authorization"), process.env.CRON_SECRET)) return void res.status(401).json({ error: "unauthorized" });
    const admin = getSupabaseAdmin();
    if (!admin) return void res.status(503).json({ error: "not_configured" });
    const { data, error } = await admin.rpc("trafficflow_expire_subscriptions", { p_grace_days: 7 });
    if (error) { console.error("[Cron] expire failed:", error.message); return void res.status(500).json({ error: "failed" }); }
    res.status(200).json({ ok: true, updated: data });
  });

  app.get("/api/cron/social-tokens", async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req.get("authorization"), process.env.CRON_SECRET)) return void res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await refreshExpiringSocialTokens();
      res.status(200).json({ ok: true, ...summary });
    } catch (error) {
      console.error("[Cron] social token refresh failed:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "social_token_refresh_failed" });
    }
  });
  app.get("/api/cron/analytics", async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req.get("authorization"), process.env.CRON_SECRET)) return void res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await runAnalyticsCollectors();
      res.status(200).json({ ok: true, ...summary });
    } catch (error) {
      console.error("[Cron] analytics collection failed:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ error: "analytics_collection_failed" });
    }
  });

  app.get("/api/cron/publish", async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req.get("authorization"), process.env.CRON_SECRET)) return void res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await runPublicationWorker(Number(req.query.limit ?? 3));
      res.status(200).json({ ok: true, ...summary });
    } catch (error) {
      console.error("[Cron] publish failed:", error);
      res.status(500).json({ error: "publish_worker_failed" });
    }
  });

  // Vercel limite de toute façon le corps des requêtes (~4,5 Mo) ; 10 Mo couvre le serveur local.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSocialOAuthRoutes(app);

  // Diagnostic de déploiement : JSON valide, aucun secret exposé.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: "trafficflow-api", time: new Date().toISOString() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[tRPC] ${path ?? "?"}:`, error.message);
        }
      },
    }),
  );

  // Toute route /api inconnue répond en JSON (jamais en HTML/texte).
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next();
    res.status(404).json({ error: "API route not found", path: req.path });
  });

  if (attachFrontend) await attachFrontend(app);

  // Les erreurs restent en JSON : le client ne doit jamais parser une page texte comme du JSON.
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.get("x-request-id") ?? randomUUID();
    console.error(`[TrafficFlow API] ${requestId}`, error);
    if (res.headersSent) return;
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "production" ? "Request failed" : error instanceof Error ? error.message : String(error),
      requestId,
    });
  });

  return app;
}
