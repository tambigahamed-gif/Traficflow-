import type { Request, Response } from "express";

type ApiHandler = (req: Request, res: Response) => Promise<unknown> | unknown;

let apiHandlerPromise: Promise<ApiHandler> | undefined;

function loadApiHandler(): Promise<ApiHandler> {
  if (!apiHandlerPromise) {
    const bundleUrl = new URL("../dist-server/api-handler.js", import.meta.url);
    apiHandlerPromise = import(bundleUrl.href).then(module => module.default as ApiHandler);
  }
  return apiHandlerPromise;
}

export default async function handler(req: Request, res: Response) {
  const apiHandler = await loadApiHandler();
  return apiHandler(req, res);
}
