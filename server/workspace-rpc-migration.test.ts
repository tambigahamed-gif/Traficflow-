import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0011_workspace_rpc_repair.sql"), "utf8");
const baseMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0002_workspace_operations.sql"), "utf8");
const signupMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0001_trafficflow_v2.sql"), "utf8");
const profilesMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_profiles_assignments.sql"), "utf8");
const workspaceRouter = readFileSync(resolve(process.cwd(), "server/routers/workspace.ts"), "utf8");
const homePage = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("Workspace RPC corrective migration contract", () => {
  it("declares the no-argument RPC with the generated V2 return columns", () => {
    expect(migration).toMatch(/function public\.trafficflow_get_my_workspaces\(\)/i);
    expect(migration).toMatch(/returns table\s*\(\s*workspace_id uuid,\s*workspace_name text,\s*role text,\s*member_status text,\s*subscription_status text,\s*plan_code text,\s*trial_ends_at timestamptz/is);
  });

  it("returns only active memberships belonging to the authenticated Supabase identity", () => {
    expect(migration).toMatch(/where wm\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/and wm\.status\s*=\s*'active'/i);
    expect(migration).toMatch(/join public\.workspaces as w on w\.id = wm\.workspace_id/i);
    expect(migration).toMatch(/security invoker/i);
  });

  it("restricts RPC execution to authenticated and requires the V2 signup trigger", () => {
    expect(migration).toMatch(/revoke all on function public\.trafficflow_get_my_workspaces\(\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.trafficflow_get_my_workspaces\(\) to authenticated/i);
    expect(migration).toMatch(/to_regprocedure\('public\.trafficflow_create_workspace\(text\)'\)/i);
    expect(migration).toMatch(/to_regprocedure\('private\.handle_new_user\(\)'\)/i);
    expect(migration).toMatch(/on_auth_user_created_trafficflow/i);
    expect(migration).toMatch(/t\.tgenabled in \('O', 'A'\)/i);
  });

  it("fails closed when base tables are absent and requests a PostgREST schema reload", () => {
    expect(migration).toMatch(/to_regclass\('public\.workspaces'\)/i);
    expect(migration).toMatch(/to_regclass\('public\.workspace_members'\)/i);
    expect(migration).toMatch(/to_regclass\('public\.subscriptions'\)/i);
    expect(migration).toMatch(/notify pgrst,\s*'reload schema'/i);
    expect(migration.trim()).toMatch(/^begin;[\s\S]*commit;$/i);
  });

  it("keeps workspace creation authenticated and avoids scaffold-dependent failures on a fresh database", () => {
    expect(baseMigration).toMatch(/create or replace function public\.trafficflow_create_workspace\(p_name text\)/i);
    expect(baseMigration).toMatch(/current_user_id uuid := \(select auth\.uid\(\)\)/i);
    expect(baseMigration).toMatch(/grant execute on function public\.trafficflow_create_workspace\(text\) to authenticated/i);
    expect(baseMigration).toMatch(/to_regprocedure\('public\.rls_auto_enable\(\)'\)/i);
    expect(baseMigration).toMatch(/security invoker/i);
  });

  it("provisions profile, owner membership, workspace, and trial on new Auth signup", () => {
    expect(signupMigration).toMatch(/create trigger on_auth_user_created_trafficflow after insert on auth\.users for each row execute function private\.handle_new_user\(\)/i);
    expect(signupMigration).toMatch(/insert into public\.workspaces\(name, owner_id\).*new\.id/i);
    expect(signupMigration).toMatch(/insert into public\.workspace_members\(workspace_id, user_id, role, status\) values \(new_workspace_id, new\.id, 'owner', 'active'\)/i);
    expect(signupMigration).toMatch(/insert into public\.subscriptions\(workspace_id, plan_code, status, trial_starts_at, trial_ends_at\) values \(new_workspace_id, 'starter', 'trialing'/i);
    expect(profilesMigration).toMatch(/insert into public\.profiles\(id,full_name,email\).*new\.id/is);
    expect(profilesMigration).toMatch(/insert into public\.workspaces\(name, owner_id\).*new\.id/i);
    expect(profilesMigration).toMatch(/insert into public\.workspace_members\(workspace_id, user_id, role, status\) values \(new_workspace_id, new\.id, 'owner', 'active'\)/i);
    expect(profilesMigration).toMatch(/insert into public\.subscriptions\(workspace_id, plan_code, status, trial_starts_at, trial_ends_at\) values \(new_workspace_id, 'starter', 'trialing'/i);
  });

  it("lets an authenticated existing account explicitly create a workspace when its list is empty", () => {
    expect(workspaceRouter).toMatch(/list:\s*protectedProcedure\.query/i);
    expect(workspaceRouter).toMatch(/rpc\("trafficflow_get_my_workspaces"\)/i);
    expect(workspaceRouter).toMatch(/create:\s*protectedProcedure\.input[\s\S]*?rpc\("trafficflow_create_workspace"/i);
    expect(homePage).toMatch(/if \(!workspace\)[\s\S]*?Créez un Workspace sécurisé/i);
    expect(homePage).toMatch(/onSubmit=\{createWorkspace\}/i);
    expect(baseMigration).toMatch(/if current_user_id is null then raise exception 'authentication_required'/i);
    expect(baseMigration).toMatch(/insert into public\.workspace_members\(workspace_id,user_id,role,status\) values\(new_id,current_user_id,'owner','active'\)/i);
  });
});
