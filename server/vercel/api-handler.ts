import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../_core/app";
import { restoreExpressApiUrl } from "./routing";

// Reuse the full production API app, including billing webhook and subscription cron.
// createApp() does not attach Vite unless an attachFrontend callback is supplied.
const appPromise = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const routedUrl = restoreExpressApiUrl(req.url);
    if (routedUrl) req.url = routedUrl;
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
