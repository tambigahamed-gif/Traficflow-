import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    authId: null,
    isSuperAdmin: false,
    supabase: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ...overrides,
  };
}

const ordinaryUser = {
  id: 10,
  openId: "ordinary-user",
  name: "Ordinary User",
  email: "ordinary@example.com",
  loginMethod: "supabase" as const,
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("admin router authorization", () => {
  it("rejects anonymous overview access", async () => {
    await expect(appRouter.createCaller(context()).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a normal authenticated user even when they have a Workspace admin role", async () => {
    await expect(appRouter.createCaller(context({ user: { ...ordinaryUser, role: "admin" }, authId: "00000000-0000-4000-8000-000000000010" })).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not authorize from the frontend role alone", async () => {
    await expect(appRouter.createCaller(context({ user: ordinaryUser, authId: "00000000-0000-4000-8000-000000000011", isSuperAdmin: false })).admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes authorization only with server-verified global role, then fails closed without server credentials", async () => {
    await expect(appRouter.createCaller(context({ user: ordinaryUser, authId: "00000000-0000-4000-8000-000000000012", isSuperAdmin: true })).admin.overview()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
