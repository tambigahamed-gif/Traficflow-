import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/0014_business_post_approvals.sql", import.meta.url), "utf8");

describe("migration de validation des publications Business", () => {
  it("est additive et ne supprime pas des posts ou demandes existants", () => {
    expect(migration).toMatch(/create table if not exists public\.post_approval_requests/i);
    expect(migration).not.toMatch(/\b(?:delete\s+from|truncate\s+(?:table\s+)?)(?:public\.)?(?:posts|post_approval_requests)\b/i);
    expect(migration).toMatch(/notify pgrst, 'reload schema'/i);
  });

  it("exige une demande approuvée pour chaque programmation Business directe", () => {
    expect(migration).toMatch(/private\.workspace_uses_post_approval\(new\.workspace_id\)/i);
    expect(migration).toMatch(/latest_status is distinct from 'approved'/i);
    expect(migration).toMatch(/before insert or update on public\.posts/i);
    expect(migration).toMatch(/'approval_required:business_schedule'/i);
  });

  it("rattache la demande à une version immuable et vérifie le brouillon au moment de l’approbation", () => {
    expect(migration).toMatch(/post_snapshot jsonb not null/i);
    expect(migration).toMatch(/request_row\.post_snapshot <> jsonb_build_object/i);
    expect(migration).toMatch(/approval_post_changed_since_submission/i);
    expect(migration).toMatch(/requested_scheduled_at <= now\(\)/i);
    expect(migration).toMatch(/has_workspace_permission\(p_workspace_id, 'schedule'\)/i);
    expect(migration).toMatch(/can_access_account\(p_workspace_id, post_row\.social_account_id, 'schedule'\)/i);
  });

  it("protège les lectures par RLS et réserve la décision aux rôles responsables, sans auto-approbation", () => {
    expect(migration).toMatch(/alter table public\.post_approval_requests enable row level security/i);
    expect(migration).toMatch(/private\.can_access_account\(post\.workspace_id, post\.social_account_id, 'view_content'\)/i);
    expect(migration).toMatch(/private\.has_workspace_role\(workspace_id, array\['owner','admin'\]\)/i);
    expect(migration).toMatch(/private\.has_workspace_role\(p_workspace_id, array\['owner','admin','manager'\]\)/i);
    expect(migration).toMatch(/requester_cannot_approve_own_post/i);
    expect(migration).toMatch(/grant execute on function public\.trafficflow_decide_post_approval[\s\S]*?to authenticated/i);
  });

  it("notifie uniquement via les notifications internes existantes", () => {
    expect(migration).toMatch(/insert into public\.notifications\(workspace_id, user_id, kind, title, body, href\)/i);
    expect(migration).toMatch(/member\.role in \('owner','admin','manager'\)/i);
    expect(migration).toMatch(/request_row\.requested_by/i);
    expect(migration).not.toMatch(/http[s]?:\/\/.*(?:facebook|instagram|tiktok|youtube)/i);
  });
});
