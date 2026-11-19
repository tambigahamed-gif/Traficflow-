import type { Database } from "@shared/database.types";
import { supabase } from "@/lib/supabase";

export type AccountRow = Database["public"]["Tables"]["social_accounts"]["Row"];
export type AssistantRow = Database["public"]["Tables"]["ai_assistants"]["Row"];
export type MediaRow = Database["public"]["Tables"]["media"]["Row"];
export type PostRow = Database["public"]["Tables"]["posts"]["Row"];
export type MemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type FolderRow = Database["public"]["Tables"]["media_folders"]["Row"];
export type WorkflowRow = Database["public"]["Tables"]["automation_workflows"]["Row"];
export type AnalyticsSnapshotRow = { id: number; workspace_id: string; social_account_id: number; platform: string; provider_object_id: string; metric_date: string; metrics: Record<string, number>; source: string; collected_at: string; created_at: string };

export type WorkspaceSnapshot = {
  accounts: AccountRow[];
  assistants: AssistantRow[];
  media: (MediaRow & { display_url: string | null })[];
  mediaAccountLinks: Database["public"]["Tables"]["media_account_links"]["Row"][];
  posts: PostRow[];
  members: MemberRow[];
  profiles: Database["public"]["Tables"]["profiles"]["Row"][];
  assignments: Database["public"]["Tables"]["account_assignments"]["Row"][];
  tasks: TaskRow[];
  notifications: NotificationRow[];
  folders: FolderRow[];
  workflows: WorkflowRow[];
  workflowRuns: Database["public"]["Tables"]["automation_runs"]["Row"][];
  usage: Database["public"]["Functions"]["trafficflow_get_usage_v3"]["Returns"][number] | null;
  planRequests: Database["public"]["Tables"]["plan_change_requests"]["Row"][];
  subscriptionEvents: Database["public"]["Tables"]["subscription_events"]["Row"][];
  invitations: Database["public"]["Tables"]["workspace_invitations"]["Row"][];
  analyticsSnapshots: AnalyticsSnapshotRow[];
  legacyImported: boolean;
  errors: string[];
};

export function emptyWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    accounts: [], assistants: [], media: [], mediaAccountLinks: [], posts: [], members: [], profiles: [], assignments: [], tasks: [],
    notifications: [], folders: [], workflows: [], workflowRuns: [], usage: null, planRequests: [], subscriptionEvents: [], invitations: [], analyticsSnapshots: [],
    legacyImported: false, errors: [],
  };
}

export async function fetchWorkspaceSnapshot(workspaceId: string, isAdmin: boolean): Promise<WorkspaceSnapshot> {
  const state = emptyWorkspaceSnapshot();
  const collect = <T>(label: string, result: { data: T | null; error: { message: string } | null }, assign: (data: T) => void) => {
    if (result.error) state.errors.push(`${label}: ${result.error.message}`);
    else if (result.data !== null) assign(result.data);
  };

  const [accounts, assistants, media, mediaAccountLinks, posts, members, assignments, tasks, notifications, folders, workflows, runs, usage, plansReq, events, invites, imports, analyticsSnapshots] = await Promise.all([
    supabase.from("social_accounts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("ai_assistants").select("*").eq("workspace_id", workspaceId),
    supabase.from("media").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("media_account_links").select("*").eq("workspace_id", workspaceId),
    supabase.from("posts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500),
    supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId).order("joined_at", { ascending: true }),
    supabase.from("account_assignments").select("*").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500),
    supabase.from("notifications").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
    supabase.from("media_folders").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("automation_workflows").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("automation_runs").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("trafficflow_get_usage_v3", { p_workspace_id: workspaceId }),
    supabase.from("plan_change_requests").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    supabase.from("subscription_events").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    isAdmin ? supabase.from("workspace_invitations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] as Database["public"]["Tables"]["workspace_invitations"]["Row"][], error: null }),
    supabase.from("legacy_imports").select("workspace_id").eq("workspace_id", workspaceId).maybeSingle(),
    (supabase as any).from("analytics_snapshots").select("*").eq("workspace_id", workspaceId).order("metric_date", { ascending: false }).limit(1000),
  ]);

  collect("Comptes", accounts, value => { state.accounts = value; });
  collect("Assistants IA", assistants, value => { state.assistants = value; });
  collect("Médias", media, value => { state.media = value.map(item => ({ ...item, display_url: item.source_url })); });
  collect("Liens des médias", mediaAccountLinks, value => { state.mediaAccountLinks = value; });
  collect("Publications", posts, value => { state.posts = value; });
  collect("Membres", members, value => { state.members = value; });
  collect("Affectations", assignments, value => { state.assignments = value; });
  collect("Tâches", tasks, value => { state.tasks = value; });
  collect("Notifications", notifications, value => { state.notifications = value; });
  collect("Dossiers", folders, value => { state.folders = value; });
  collect("Automatisations", workflows, value => { state.workflows = value; });
  collect("Historique des automatisations", runs, value => { state.workflowRuns = value; });
  collect("Limites d’abonnement", usage, value => { state.usage = value?.[0] ?? null; });
  collect("Demandes de plan", plansReq, value => { state.planRequests = value; });
  collect("Historique d’abonnement", events, value => { state.subscriptionEvents = value; });
  collect("Invitations", invites, value => { state.invitations = value; });
  collect("Snapshots Analytics", analyticsSnapshots, value => { state.analyticsSnapshots = value as AnalyticsSnapshotRow[]; });
  if (imports.error) state.errors.push(`Import historique: ${imports.error.message}`);
  else state.legacyImported = Boolean(imports.data);

  const profileIds = Array.from(new Set(state.members.map(row => row.user_id)));
  if (profileIds.length) {
    const profiles = await supabase.from("profiles").select("*").in("id", profileIds);
    collect("Profils", profiles, value => { state.profiles = value; });
  }
  const mediaWithPaths = state.media.filter(item => item.storage_path);
  if (mediaWithPaths.length) {
    const signed = await supabase.storage.from("trafficflow-media").createSignedUrls(mediaWithPaths.map(item => item.storage_path!), 3600);
    if (signed.error) state.errors.push(`Médias privés: ${signed.error.message}`);
    else {
      const signedUrls = new Map((signed.data ?? []).map(row => [row.path, row.signedUrl]));
      state.media = state.media.map(item => ({ ...item, display_url: item.storage_path ? signedUrls.get(item.storage_path) ?? item.source_url : item.source_url }));
    }
  }
  return state;
}
