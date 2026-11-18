import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    authId: null,
    supabase: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace API authorization", () => {
  it("rejects workspace listing without an authenticated user", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.workspace.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects legacy imports without an authenticated user", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.legacyImport.importLegacy({ workspaceId: "00000000-0000-4000-8000-000000000001" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
