import { getSupabaseAdmin } from "../_core/supabaseAdmin";
import { publishPost } from "../integrations/social-publishers";

export type WorkerSummary = { claimed: number; published: number; failed: number; retrying: number; skipped: number; automations: number };

type Admin = ReturnType<typeof getSupabaseAdmin>;

type AutomationContext = {
  postId: number;
  workspaceId: string;
  title: string;
  platform: string;
  status: "published" | "failed";
  providerPostId?: string | null;
  error?: string | null;
};

function matchesCondition(condition: unknown, context: AutomationContext) {
  if (!condition || typeof condition !== "object") return true;
  const entries = Object.entries(condition as Record<string, unknown>);
  return entries.every(([key, expected]) => {
    if (expected === undefined || expected === null || expected === "") return true;
    const actual = (context as Record<string, unknown>)[key];
    return String(actual ?? "") === String(expected);
  });
}
export function shouldRetryPublication(error: unknown, attempts: number) {
  if (attempts >= 3) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /provider_(408|409|425|429|500|502|503|504):|timeout|timed out|network|fetch failed/i.test(message);
}
export function retryDelayMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}
function retryAt(attempts: number) {
  const delayMinutes = retryDelayMinutes(attempts);
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

async function executePostAutomations(admin: NonNullable<Admin>, context: AutomationContext) {
  const trigger = context.status === "published" ? "post_published" : "post_failed";
  const { data: workflows, error } = await (admin.from("automation_workflows") as any)
    .select("id,name,condition,action_type,action_config")
    .eq("workspace_id", context.workspaceId)
    .eq("trigger_type", trigger)
    .eq("enabled", true);
  if (error) throw error;

  let executed = 0;
  for (const workflow of (workflows ?? []) as any[]) {
    if (!matchesCondition(workflow.condition, context)) continue;
    const payload = { trigger: trigger, ...context };
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await (admin.from("automation_runs") as any)
      .insert({ workspace_id: context.workspaceId, workflow_id: workflow.id, status: "running", attempts: 1, trigger_payload: payload, started_at: startedAt })
      .select("id")
      .single();
    if (runError) throw runError;

    try {
      const action = String(workflow.action_type);
      const configuredMessage = typeof workflow.action_config?.message === "string" ? workflow.action_config.message : "";
      const baseMessage = configuredMessage || (context.status === "published"
        ? `${context.title} a été publié sur ${context.platform}.`
        : `${context.title} n’a pas pu être publié sur ${context.platform}.`);
      let result: Record<string, unknown> = { action, trigger };

      if (action === "notify_va" || action === "notify_manager") {
        const roles = action === "notify_va" ? ["va"] : ["owner", "admin", "manager"];
        const { data: members, error: memberError } = await (admin.from("workspace_members") as any)
          .select("user_id")
          .eq("workspace_id", context.workspaceId)
          .eq("status", "active")
          .in("role", roles);
        if (memberError) throw memberError;
        const notifications = (members ?? []).map((member: any) => ({
          workspace_id: context.workspaceId,
          user_id: member.user_id,
          kind: `automation_${trigger}`,
          title: workflow.name,
          body: baseMessage,
          href: "/publications",
        }));
        if (notifications.length) {
          const { error: notificationError } = await (admin.from("notifications") as any).insert(notifications);
          if (notificationError) throw notificationError;
        }
        result = { ...result, notified: notifications.length };
      } else if (action === "suggest_reply") {
        const { error: notificationError } = await (admin.from("notifications") as any).insert({
          workspace_id: context.workspaceId,
          user_id: null,
          kind: "automation_suggestion",
          title: workflow.name,
          body: configuredMessage || `Suggestion à préparer après l’événement « ${trigger} » pour ${context.title}.`,
          href: "/assistants",
        });
        if (notificationError) throw notificationError;
        result = { ...result, suggestion: "queued" };
      } else if (action === "refresh_analytics") {
        // Le collecteur Analytics est encore à implémenter par fournisseur. On conserve
        // l’événement pour que le futur collecteur puisse le reprendre sans faux succès.
        result = { ...result, analytics_refresh: "queued_for_connector" };
      } else {
        result = { ...result, journalized: true };
      }

      const { error: completeError } = await (admin.from("automation_runs") as any)
        .update({ status: "succeeded", result, completed_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("status", "running");
      if (completeError) throw completeError;
      executed++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 1000) : "automation_failed";
      await (admin.from("automation_runs") as any)
        .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("status", "running");
      console.error("[Automation] post event failed", workflow.id, message);
    }
  }
  return executed;
}

export async function runPublicationWorker(limit = 10): Promise<WorkerSummary> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("supabase_admin_not_configured");
  const { data: claimed, error } = await (admin.rpc as any)("trafficflow_claim_due_posts", { p_limit: Math.min(Math.max(limit, 1), 50) });
  if (error) throw error;
  const rows = (claimed ?? []) as any[];
  const summary: WorkerSummary = { claimed: rows.length, published: 0, failed: 0, retrying: 0, skipped: 0, automations: 0 };

  for (const row of rows) {
    const baseContext = { postId: Number(row.id), workspaceId: row.workspace_id, title: row.title, platform: row.platform };
    try {
      if (!row.access_token_encrypted || !row.provider_account_id) throw new Error("social_account_not_connected");
      const result = await publishPost({ post: row, account: row, mediaUrl: row.media_source_url ?? null });
      if (result.finalized === false) {
        const previous = row.provider_response && typeof row.provider_response === "object" ? row.provider_response : {};
        const checks = Number((previous as any).async_check_count ?? 0) + 1;
        if (checks > 20) throw new Error("provider_async_timeout");
        const nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await (admin.from("posts") as any).update({ status: "scheduled", scheduled_at: nextAttemptAt, updated_at: new Date().toISOString(), last_publish_error: null, provider_post_id: result.providerPostId ?? null, provider_response: { ...(result.raw as Record<string, unknown> ?? {}), async: true, provider_status: result.providerStatus ?? "PENDING", async_check_count: checks, next_check_at: nextAttemptAt } }).eq("id", row.id).eq("status", "processing");
        summary.retrying++;
        continue;
      }
      const { error: updateError } = await (admin.from("posts") as any).update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_publish_error: null, provider_post_id: result.providerPostId ?? null, provider_post_url: result.providerUrl ?? null, provider_response: result.raw ?? {} }).eq("id", row.id).eq("status", "processing");
      if (updateError) throw updateError;
      await (admin.from("notifications") as any).insert({ workspace_id: row.workspace_id, user_id: row.created_by ?? null, kind: "publish_success", title: "Publication envoyée", body: `${row.title} a été publié sur ${row.platform}.`, href: "/publications" });
      summary.automations += await executePostAutomations(admin, { ...baseContext, status: "published", providerPostId: result.providerPostId ?? null });
      summary.published++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 1000) : "publication_failed";
      const attempts = Number(row.publish_attempts ?? 1);
      if (shouldRetryPublication(cause, attempts)) {
        const nextAttemptAt = retryAt(attempts);
        await (admin.from("posts") as any).update({ status: "scheduled", scheduled_at: nextAttemptAt, updated_at: new Date().toISOString(), last_publish_error: message, provider_response: { error: message, retrying: true, next_attempt_at: nextAttemptAt } }).eq("id", row.id).eq("status", "processing");
        await (admin.from("notifications") as any).insert({ workspace_id: row.workspace_id, user_id: row.created_by ?? null, kind: "publish_retrying", title: "Nouvelle tentative planifiée", body: `${row.title} sera retenté après une erreur temporaire sur ${row.platform}.`, href: "/publications" });
        summary.retrying++;
        continue;
      }
      await (admin.from("posts") as any).update({ status: "failed", updated_at: new Date().toISOString(), last_publish_error: message, provider_response: { error: message, attempts } }).eq("id", row.id).eq("status", "processing");
      await (admin.from("notifications") as any).insert({ workspace_id: row.workspace_id, user_id: row.created_by ?? null, kind: "publish_failed", title: "Échec de publication", body: `${row.title} : ${message}`, href: "/publications" });
      summary.automations += await executePostAutomations(admin, { ...baseContext, status: "failed", error: message });
      summary.failed++;
    }
  }
  return summary;
}
