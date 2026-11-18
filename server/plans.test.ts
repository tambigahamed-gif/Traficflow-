import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, PLAN_LIMIT_MESSAGES, TRIAL_DAYS, planLimitMessage } from "../shared/plans";
import { SASPAY_ADAPTER_IMPLEMENTED, verifySaspayWebhook } from "./integrations/saspay";

const migration = readFileSync(new URL("../supabase/migrations/0012_plans_v3_billing.sql", import.meta.url), "utf8");

describe("forfaits", () => {
  it("expose les quatre forfaits demandés avec les bons prix", () => {
    expect(PLANS.map(p => [p.code, p.priceUsd])).toEqual([["free", 0], ["standard", 9], ["pro", 29], ["business", 99]]);
    expect(PLANS.map(p => [p.socialAccounts, p.linkPages, p.virtualAssistants, p.members, p.scheduledPosts, p.aiMessages, p.automations])).toEqual([
      [3, 1, 0, 1, 20, 20, 0], [10, 5, 2, 3, 100, 250, 5],
      [50, 20, 9, 10, 500, 750, 25], [150, null, 29, 30, 2000, 2000, 100],
    ]);
    expect(TRIAL_DAYS).toBe(7);
  });
  it("garde la migration SQL cohérente avec shared/plans.ts", () => {
    expect(migration).toMatch(/\('free',\s+'Free',\s+0,\s+3,\s+0,\s+1,\s+1,\s+20,\s+20,\s+0,/);
    expect(migration).toMatch(/\('standard',\s+'Standard',\s+9,\s+10,\s+2,\s+3,\s+5,\s+100,\s+250,\s+5,/);
    expect(migration).toMatch(/\('pro',\s+'Pro',\s+29,\s+50,\s+9,\s+10,\s+20,\s+500,\s+750,\s+25,/);
    expect(migration).toMatch(/\('business',\s+'Business',\s+99,\s+150,\s+29,\s*30,\s+null,\s+2000,\s+2000,\s+100,/);
    expect(migration).toContain("interval '7 days'");
  });
  it("applique les limites côté base (triggers) et jamais côté navigateur", () => {
    for (const trigger of ["social_accounts_plan_guard", "link_pages_plan_guard", "posts_plan_guard"]) expect(migration + readFileSync(new URL("../supabase/migrations/0009_social_account_plan_guard.sql", import.meta.url), "utf8")).toContain(trigger);
    expect(migration).toContain("plan_limit:scheduled_posts");
    expect(migration).toContain("plan_limit:link_pages");
  });
  it("traduit les codes de limite en messages clairs", () => {
    for (const code of Object.keys(PLAN_LIMIT_MESSAGES)) expect(planLimitMessage(`xx ${code}`)).toBeTruthy();
    expect(planLimitMessage("autre erreur")).toBeNull();
  });
});

describe("paiements", () => {
  it("rend la confirmation réservée à service_role et idempotente", () => {
    expect(migration).toContain("to service_role");
    expect(migration).toContain("unique (provider, event_id)");
    expect(migration).toContain("amount_mismatch");
    expect(migration).toMatch(/revoke all on function public\.trafficflow_apply_payment_result[^;]*from public,anon,authenticated/);
  });
  it("refuse tout webhook tant que l'adaptateur officiel n'est pas implémenté", () => {
    expect(SASPAY_ADAPTER_IMPLEMENTED).toBe(false);
    expect(verifySaspayWebhook(Buffer.from("{}"), {})).toBeNull();
  });
});
