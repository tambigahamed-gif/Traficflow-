import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAdmin } from "../_core/supabaseAdmin";
import { superAdminProcedure, router } from "../_core/trpc";

const id = z.string().uuid();
const dbError = (message: string): never => {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
};

function requireAdminDb() {
  const db = getSupabaseAdmin();
  if (!db) dbError("La configuration Supabase serveur est incomplète.");
  return db as any;
}

async function writeAudit(db: any, actorUserId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await db.from("admin_audit_log").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) dbError("L’action n’a pas été exécutée car son journal de sécurité est indisponible.");
}

async function count(db: any, table: string, filter?: (query: any) => any) {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count: total, error } = await query;
  if (error) dbError(`Lecture impossible de ${table}.`);
  return total ?? 0;
}

async function fetchAll(db: any, table: string, columns: string, filter?: (query: any) => any) {
  const rows: any[] = [];
  for (let page = 0; page < 1000; page += 1) {
    let query = db.from(table).select(columns).range(page * 1000, page * 1000 + 999);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) dbError(`Lecture impossible de ${table}.`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
  dbError(`Lecture de ${table} trop volumineuse pour cette vue.`);
  return rows;
}

export const adminRouter = router({
  overview: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const [users, workspaces, activeSubscriptions, socialAccounts, analyticsSnapshots, payments] = await Promise.all([
      count(db, "profiles"),
      count(db, "workspaces"),
      count(db, "subscriptions", q => q.in("status", ["active", "trialing"])),
      count(db, "social_accounts", q => q.eq("is_active", true)),
      count(db, "analytics_snapshots"),
      fetchAll(db, "payment_transactions", "amount_usd, status", q => q.in("status", ["confirmed", "succeeded", "paid"])),
    ]);
    const confirmedRevenue = payments.reduce((sum: number, row: { amount_usd: number | null }) => sum + Number(row.amount_usd ?? 0), 0);
    const { data: recentAudit, error: auditError } = await db.from("admin_audit_log").select("id, action, entity_type, entity_id, created_at").order("created_at", { ascending: false }).limit(6);
    if (auditError) dbError("Lecture impossible du journal admin.");
    return { users, workspaces, activeSubscriptions, socialAccounts, analyticsSnapshots, confirmedRevenue, recentAudit: recentAudit ?? [] };
  }),

  users: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: memberships, error: membershipsError }, authUsers] = await Promise.all([
      db.from("profiles").select("id, email, full_name, created_at, updated_at").order("created_at", { ascending: false }).limit(200),
      db.from("platform_roles").select("user_id, role, granted_at, revoked_at").is("revoked_at", null),
      db.from("workspace_members").select("user_id, workspace_id, role, status").limit(1000),
      db.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    if (profilesError || rolesError || membershipsError || authUsers.error) dbError("Lecture impossible des utilisateurs.");
    const roleByUser = new Map((roles ?? []).map((row: any) => [row.user_id, row.role]));
    const membershipsByUser = new Map<string, any[]>();
    for (const row of memberships ?? []) membershipsByUser.set(row.user_id, [...(membershipsByUser.get(row.user_id) ?? []), row]);
    const authByUser = new Map<string, any>((authUsers.data.users ?? []).map((row: any) => [row.id, row] as [string, any]));
    return (profiles ?? []).map((profile: any) => {
      const authUser = authByUser.get(profile.id);
      return {
        ...profile,
        globalRole: roleByUser.get(profile.id) ?? "user",
        suspended: Boolean(authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now()),
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        memberships: membershipsByUser.get(profile.id) ?? [],
      };
    });
  }),

  subscriptions: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("subscriptions").select("id, workspace_id, plan_code, status, payment_provider, started_at, renews_at, trial_ends_at, updated_at").order("updated_at", { ascending: false }).limit(200);
    if (error) dbError("Lecture impossible des abonnements.");
    return data ?? [];
  }),

  payments: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("payment_transactions").select("id, workspace_id, plan_code, amount_usd, currency, provider, reference, provider_transaction_id, status, failure_reason, created_at, confirmed_at").order("created_at", { ascending: false }).limit(200);
    if (error) dbError("Lecture impossible des paiements.");
    return data ?? [];
  }),

  plans: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("subscription_plans").select("code, name, price_usd, social_account_limit, va_limit, member_limit, link_page_limit, scheduled_post_limit, ai_message_limit, automation_limit, advanced_analytics, team_analytics, priority_support, is_public, sort_order").order("sort_order", { ascending: true });
    if (error) dbError("Lecture impossible des plans.");
    return data ?? [];
  }),

  social: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("social_accounts").select("id, workspace_id, platform, display_name, handle, connection_status, is_active, followers, engagement_rate, connected_at, created_at").order("created_at", { ascending: false }).limit(300);
    if (error) dbError("Lecture impossible des comptes sociaux.");
    return data ?? [];
  }),

  analytics: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("analytics_snapshots").select("id, workspace_id, social_account_id, platform, provider_object_id, metric_date, metrics, source, collected_at").order("metric_date", { ascending: false }).limit(300);
    if (error) dbError("Lecture impossible des snapshots Analytics.");
    return data ?? [];
  }),

  tickets: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("support_tickets").select("id, created_by, requester_user_id, assigned_to, subject, message, status, priority, created_at, updated_at, resolved_at").order("updated_at", { ascending: false }).limit(200);
    if (error) dbError("Lecture impossible des tickets Support.");
    return data ?? [];
  }),

  auditLog: superAdminProcedure.query(async () => {
    const db = requireAdminDb();
    const { data, error } = await db.from("admin_audit_log").select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(300);
    if (error) dbError("Lecture impossible du journal d’activité.");
    return data ?? [];
  }),

  suspendUser: superAdminProcedure.input(z.object({ userId: id, suspended: z.boolean(), confirmation: z.literal("CONFIRMER") })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.authId) throw new TRPCError({ code: "FORBIDDEN", message: "Le Super Admin courant ne peut pas suspendre son propre accès." });
    const db = requireAdminDb();
    await writeAudit(db, ctx.authId, input.suspended ? "user.suspension_requested" : "user.reactivation_requested", "user", input.userId);
    const { error } = await db.auth.admin.updateUserById(input.userId, { ban_duration: input.suspended ? "876000h" : "none" });
    if (error) throw new TRPCError({ code: "BAD_REQUEST", message: "La mise à jour de l’accès utilisateur a échoué." });
    await writeAudit(db, ctx.authId, input.suspended ? "user.suspended" : "user.reactivated", "user", input.userId);
    return { success: true };
  }),

  createTicket: superAdminProcedure.input(z.object({ subject: z.string().trim().min(3).max(200), message: z.string().trim().min(1).max(10000), priority: z.enum(["low", "normal", "high", "urgent"]), requesterUserId: id.nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = requireAdminDb();
    await writeAudit(db, ctx.authId, "support.ticket_creation_requested", "support_ticket", null, { subject: input.subject, priority: input.priority });
    const { data, error } = await db.from("support_tickets").insert({ created_by: ctx.authId, requester_user_id: input.requesterUserId ?? null, subject: input.subject, message: input.message, priority: input.priority }).select("id, subject, status, priority, created_at").single();
    if (error) dbError("Création du ticket impossible.");
    await writeAudit(db, ctx.authId, "support.ticket_created", "support_ticket", data.id);
    return data;
  }),

  updateTicket: superAdminProcedure.input(z.object({ ticketId: id, status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]), priority: z.enum(["low", "normal", "high", "urgent"]), assignedTo: id.nullable().optional(), confirmation: z.literal("CONFIRMER").optional() })).mutation(async ({ ctx, input }) => {
    if (["resolved", "closed"].includes(input.status) && input.confirmation !== "CONFIRMER") throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation requise pour clôturer ou résoudre un ticket." });
    const db = requireAdminDb();
    await writeAudit(db, ctx.authId, "support.ticket_update_requested", "support_ticket", input.ticketId, { status: input.status, priority: input.priority });
    const { data, error } = await db.from("support_tickets").update({ status: input.status, priority: input.priority, assigned_to: input.assignedTo ?? null }).eq("id", input.ticketId).select("id, status, priority, assigned_to, updated_at, resolved_at").single();
    if (error || !data) dbError("Mise à jour du ticket impossible.");
    await writeAudit(db, ctx.authId, "support.ticket_updated", "support_ticket", input.ticketId, { status: input.status, priority: input.priority });
    return data;
  }),
});
