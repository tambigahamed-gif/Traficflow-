import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../_core/app";

const appPromise = createApp();

/**
 * Point d'entrée Vercel. Il est compilé par esbuild en `api/index.js` (voir
 * `pnpm build:api`) afin d'éviter les imports ESM sans extension qui causaient
 * `ERR_MODULE_NOT_FOUND`.
 *
 * vercel.json réécrit `/api/:path*` vers `/api?path=:path*`. On restaure ici
 * l'URL d'origine ET on conserve le reste de la query string (indispensable à
 * tRPC : `?batch=1&input=...`).
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? "/", "http://internal");
    const path = url.searchParams.get("path");
    if (path !== null) {
      url.searchParams.delete("path");
      const query = url.searchParams.toString();
      req.url = `/api/${path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
    }
    const app = await appPromise;
    return app(req as never, res as never);
  } catch (error) {
    console.error("[TrafficFlow API] startup failure", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify({ error: "API startup failure", message: "Request failed" }));
  }
}
