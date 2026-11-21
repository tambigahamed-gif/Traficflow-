import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { accountsRouter } from "./routers/accounts";
import { approvalsRouter } from "./routers/approvals";
import { billingRouter } from "./routers/billing";
import { contentRouter } from "./routers/content";
import { legacyImportRouter, workspaceRouter } from "./routers/workspace";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  accounts: accountsRouter,
  approvals: approvalsRouter,
  billing: billingRouter,
  content: contentRouter,
  workspace: workspaceRouter,
  legacyImport: legacyImportRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
