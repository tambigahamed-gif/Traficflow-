import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { router, superAdminProcedure } from "./_core/trpc";

const probeRouter = router({
  probe: superAdminProcedure.query(({ ctx }) => ({ ok: ctx.isSuperAdmin })),
});

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

describe("superAdminProcedure", () => {
  it("rejects anonymous callers", async () => {
    await expect(
      probeRouter.createCaller(context()).probe()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects authenticated users without the global role", async () => {
    await expect(
      probeRouter
        .createCaller(
          context({
            user: {
              id: 1,
              openId: "ordinary-user",
              name: "Ordinary User",
              email: "ordinary@example.com",
              loginMethod: "supabase",
              role: "user",
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSignedIn: new Date(),
            },
            authId: "00000000-0000-4000-8000-000000000001",
          })
        )
        .probe()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts only a server-verified Super Admin context", async () => {
    await expect(
      probeRouter
        .createCaller(
          context({
            user: {
              id: 1,
              openId: "owner-user",
              name: "Owner",
              email: "owner@example.com",
              loginMethod: "supabase",
              role: "user",
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSignedIn: new Date(),
            },
            authId: "00000000-0000-4000-8000-000000000002",
            isSuperAdmin: true,
          })
        )
        .probe()
    ).resolves.toEqual({ ok: true });
  });
});
