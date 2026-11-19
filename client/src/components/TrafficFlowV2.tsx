import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, CreditCard, FileText, FolderOpen, KeyRound, Loader2, Lock, Mail, Plus, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { sha256Hex, supabase, supabaseConfigured, type TrafficWorkspace, type WorkspaceRole } from "@/lib/supabase";
import type { WorkspaceSnapshot } from "@/lib/workspace-data";
import type { Database } from "@shared/database.types";
import { PLANS, TRIAL_DAYS } from "@shared/plans";
import BrandMark from "@/components/BrandMark";

const permissionOptions = [
  ["view_analytics", "Voir les analytics"],
  ["create_content", "Créer du contenu"],
  ["edit_content", "Modifier le contenu"],
  ["schedule", "Programmer"],
  ["publish", "Publier (si OAuth autorisé)"],
  ["view_interactions", "Voir les interactions"],
  ["use_ai", "Utiliser l’assistant IA"],
  ["manage_social_accounts", "Gérer les comptes"],
  ["manage_team", "Gérer l’équipe"],
] as const;

export function AuthGate({ inviteToken }: { inviteToken: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured) return toast.error("Supabase Auth n’est pas configuré. Vérifiez les variables sécurisées du projet.");
    setPending(true);
    setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Connexion réussie");
      } else if (mode === "signup") {
        const redirectTo = new URL(window.location.origin);
        if (inviteToken) redirectTo.searchParams.set("invite", inviteToken);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password, options: {
            data: { full_name: name.trim() }, emailRedirectTo: redirectTo.toString(),
          },
        });
        if (error) throw error;
        if (data.session) toast.success("Votre espace TrafficFlow est prêt");
        else setMessage("Un e-mail de confirmation vient d’être demandé. Confirmez-le pour ouvrir votre workspace.");
      } else {
        const redirectTo = new URL(window.location.origin);
        if (inviteToken) redirectTo.searchParams.set("invite", inviteToken);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo.toString() });
        if (error) throw error;
        setMessage("Si cette adresse est enregistrée, un e-mail de récupération a été demandé.");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Une erreur est survenue.";
      toast.error(text.toLowerCase().includes("redirect") ? "L’URL de retour doit être autorisée dans Supabase Auth → URL Configuration." : text);
    } finally {
      setPending(false);
    }
  }

  return <main className="tf-login"><div className="login-card tf-auth-card"><BrandMark large /><div className="eyebrow">SOCIAL CONTROL CENTER · TRAFFICFLOW V2</div>
    <h1>{mode === "login" ? <>Tous vos réseaux.<br /><span>Un seul cockpit.</span></> : mode === "signup" ? <>Votre espace.<br /><span>Votre équipe.</span></> : <>Récupérez votre<br /><span>accès sécurisé.</span></>}</h1>
    <p>{mode === "login" ? "Connectez-vous à votre espace pour retrouver vos comptes, contenus et publications." : mode === "signup" ? "Créez un workspace privé, prêt à accueillir votre équipe." : "Recevez un lien sécurisé pour choisir un nouveau mot de passe."}</p>
    {inviteToken && <div className="tf-invite-preview"><Mail size={16} /><span>Un lien d’invitation est présent. Connectez-vous ou créez un compte avec <b>l’adresse e-mail à laquelle il a été envoyé</b>; son acceptation sera vérifiée par Supabase.</span></div>}
    <form onSubmit={submit} className="tf-auth-form">
      {mode === "signup" && <label>Nom complet<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Camille Martin" /></label>}
      <label>Adresse e-mail<input autoComplete="email" type="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></label>
      {mode !== "reset" && <label>Mot de passe<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" /></label>}
      {message && <div className="tf-auth-message"><Mail size={15} />{message}</div>}
      <button className="btn-primary login-btn" disabled={pending || !supabaseConfigured}>{pending ? <Loader2 className="spin" size={16} /> : mode === "reset" ? <Mail size={16} /> : <Lock size={16} />}{pending ? "Un instant…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon workspace" : "Envoyer le lien"}<ArrowRight size={16} /></button>
    </form>
    {!supabaseConfigured && <div className="tf-auth-warning">La connexion Supabase nécessite l’URL et la clé <b>publishable</b> dans les variables du projet. Aucun secret de service n’est attendu.</div>}
    <div className="tf-auth-switch">{mode === "login" ? <><button onClick={() => setMode("signup")}>Créer un compte</button><button onClick={() => setMode("reset")}>Mot de passe oublié ?</button></> : <button onClick={() => setMode("login")}><ArrowLeft size={13} /> Retour à la connexion</button>}</div>
    <div className="login-foot"><ShieldCheck size={14} /> Sessions vérifiées par Supabase Auth · Données isolées par RLS</div>
  </div><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /></main>;
}

export function TeamView({ workspace, snapshot, canManage, canManageTasks, currentUserId, onRefresh }: {
  workspace: TrafficWorkspace; snapshot: WorkspaceSnapshot; canManage: boolean; canManageTasks: boolean; currentUserId: string; onRefresh: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"va" | "manager" | "admin">("va");
  const [invitePermissions, setInvitePermissions] = useState<Record<string, boolean>>({ view_content: true, create_content: true, edit_content: true, schedule: true, use_ai: true, view_analytics: true });
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteTargetEmail, setInviteTargetEmail] = useState("");
  const [assignmentFor, setAssignmentFor] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskAccount, setTaskAccount] = useState("");
  const invite = trpc.workspace.invite.useMutation({ onSuccess: async () => { toast.success("Invitation sécurisée créée. Copiez le lien pour l’envoyer."); onRefresh(); }, onError: error => toast.error(error.message) });
  const setMember = trpc.workspace.setMember.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const changeRole = trpc.workspace.updateMemberRole.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const removeMember = trpc.workspace.removeMember.useMutation({ onSuccess: () => { toast.success("Accès et affectations retirés"); onRefresh(); }, onError: error => toast.error(error.message) });
  const revoke = trpc.workspace.revokeInvitation.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const assign = trpc.workspace.assignAccount.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const unassign = trpc.workspace.unassignAccount.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const createTask = trpc.workspace.createTask.useMutation({ onSuccess: () => { toast.success("Tâche créée"); setTaskOpen(false); setTaskTitle(""); onRefresh(); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.workspace.updateTaskStatus.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) });
  const profiles = new Map(snapshot.profiles.map(profile => [profile.id, profile]));
  const memberRows = snapshot.members.map(member => ({ ...member, profile: profiles.get(member.user_id), assignedAccounts: snapshot.assignments.filter(a => a.user_id === member.user_id), taskCount: snapshot.tasks.filter(task => task.assigned_to === member.user_id && task.status !== "done" && task.status !== "canceled").length }));
  const activeMembers = memberRows.filter(member => member.status === "active").length;
  const activeVas = memberRows.filter(member => member.role === "va" && member.status === "active").length;
  const pendingInvites = snapshot.invitations.filter(row => !row.accepted_at && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now());

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    try {
      const tokenHash = await sha256Hex(rawToken);
      await invite.mutateAsync({ workspaceId: workspace.workspace_id, email: email.trim(), role, tokenHash, permissions: invitePermissions });
      const url = new URL(window.location.origin);
      url.searchParams.set("invite", rawToken);
      setInviteUrl(url.toString());
      setInviteTargetEmail(email.trim());
      setEmail("");
    } catch { /* the mutation reports its error */ }
  }

  return <><div className="section-heading"><div><div className="eyebrow">WORKSPACE · ÉQUIPE</div><h1>Équipe & VA</h1><p>Rôles, accès attribués, tâches et activité récente — chaque action est protégée par RLS.</p></div><div className="tf-team-actions"><button className="btn-secondary" onClick={() => setTaskOpen(true)} disabled={!canManageTasks}><Check size={15} /> Nouvelle tâche</button><button className="btn-primary" onClick={() => setInviteOpen(true)} disabled={!canManage}><Plus size={15} /> Inviter un membre</button></div></div>
    <div className="tf-team-summary"><div><Users size={16} /><span><b>{snapshot.usage?.members_used ?? activeMembers}/{snapshot.usage?.member_limit ?? 0}</b> membres actifs</span></div><div><BadgeCheck size={16} /><span><b>{activeVas}/{PLANS.find(plan => plan.code === (snapshot.usage?.effective_plan_code ?? workspace.plan_code))?.virtualAssistants ?? 0}</b> sièges VA utilisés</span></div><div><FileText size={16} /><span><b>{snapshot.tasks.filter(t => t.status !== "done" && t.status !== "canceled").length}</b> tâches en cours</span></div><div><Clock3 size={16} /><span><b>{pendingInvites.length}</b> invitations en attente</span></div></div>
    {!canManage && <div className="tf-info-banner"><ShieldCheck size={16} /> Vous pouvez consulter les membres de ce Workspace, mais seul son propriétaire ou un administrateur peut les modifier.</div>}
    <div className="panel tf-team-panel"><div className="tf-panel-title"><div><h2>Membres du workspace</h2><p>Le rôle et les autorisations sont contrôlés côté serveur.</p></div><span className="tf-badge">{workspace.role === "owner" ? "PROPRIÉTAIRE" : workspace.role.toUpperCase()}</span></div>
      <div className="tf-table-wrap"><table className="tf-table"><thead><tr><th>Membre</th><th>Rôle</th><th>Comptes assignés</th><th>Tâches</th><th>Dernière activité</th><th>Accès</th><th /></tr></thead><tbody>{memberRows.map(member => <tr key={member.user_id}><td><div className="tf-member"><span className="tf-member-avatar">{(member.profile?.full_name || member.profile?.email || "?").slice(0,1).toUpperCase()}</span><span><b>{member.profile?.full_name || "Membre TrafficFlow"}</b><small>{member.profile?.email || "Profil privé"}</small></span></div></td><td>{member.role === "owner" ? <span className="tf-role-owner">Propriétaire</span> : <select className="tf-inline-select" value={member.role} disabled={!canManage || member.user_id === currentUserId} onChange={event => changeRole.mutate({ workspaceId: workspace.workspace_id, userId: member.user_id, role: event.target.value as "admin" | "manager" | "va" })}><option value="admin">Admin</option><option value="manager">Manager</option><option value="va">VA</option></select>}</td><td><button className="tf-table-action" onClick={() => setAssignmentFor(assignmentFor === member.user_id ? null : member.user_id)} disabled={!canManage || member.role === "owner"}> {member.assignedAccounts.length} compte{member.assignedAccounts.length === 1 ? "" : "s"} · gérer</button></td><td><b>{member.taskCount}</b></td><td>{member.last_active_at ? new Date(member.last_active_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "Jamais"}</td><td><span className={`tf-status ${member.status}`}>{member.status === "active" ? "Actif" : member.status === "suspended" ? "Suspendu" : "Invité"}</span></td><td><div className="tf-row-actions">{member.role !== "owner" && member.user_id !== currentUserId && canManage && <><button className="tf-text-button" onClick={() => setMember.mutate({ workspaceId: workspace.workspace_id, userId: member.user_id, role: member.role as "admin"|"manager"|"va", status: member.status === "active" ? "suspended" : "active", permissions: member.permissions as Record<string, boolean> })}>{member.status === "active" ? "Suspendre" : "Réactiver"}</button><button className="tf-text-button danger" onClick={() => { if (window.confirm("Retirer ce membre, ses affectations et ses tâches de ce workspace ?")) removeMember.mutate({ workspaceId: workspace.workspace_id, userId: member.user_id }); }}>Retirer</button></>}</div></td></tr>)}{!memberRows.length && <tr><td colSpan={7} className="tf-empty-cell">Aucun membre trouvé.</td></tr>}</tbody></table></div>
      {assignmentFor && <AssignmentPanel workspaceId={workspace.workspace_id} member={memberRows.find(row => row.user_id === assignmentFor)!} accounts={snapshot.accounts} assignments={snapshot.assignments.filter(row => row.user_id === assignmentFor)} canManage={canManage} onAssign={(accountId, permissions) => assign.mutate({ workspaceId: workspace.workspace_id, accountId, userId: assignmentFor, permissions })} onUnassign={accountId => unassign.mutate({ workspaceId: workspace.workspace_id, accountId, userId: assignmentFor })} />}
    </div>
    {pendingInvites.length > 0 && <div className="panel tf-team-panel"><div className="tf-panel-title"><div><h2>Invitations en attente</h2><p>Le lien n’est pas envoyé automatiquement ; copiez-le pour le transmettre au membre.</p></div></div>{pendingInvites.map(row => <div className="tf-invite-row" key={row.id}><Mail size={16} /><b>{row.email}</b><span>{row.role}</span><small>Expire le {new Date(row.expires_at).toLocaleDateString("fr-FR")}</small>{canManage && <button className="tf-text-button danger" onClick={() => revoke.mutate({ workspaceId: workspace.workspace_id, invitationId: row.id })}>Révoquer</button>}</div>)}</div>}
    <div className="panel tf-team-panel"><div className="tf-panel-title"><div><h2>Tâches de l’équipe</h2><p>Assignées par compte, suivies par leur responsable.</p></div></div><div className="tf-task-list">{snapshot.tasks.map(task => { const assignee = profiles.get(task.assigned_to ?? ""); return <div className="tf-task-row" key={task.id}><button className={`tf-task-check ${task.status === "done" ? "done" : ""}`} aria-label="Changer l’état" onClick={() => updateTask.mutate({ workspaceId: workspace.workspace_id, taskId: task.id, status: task.status === "done" ? "todo" : "done" })}><Check size={13} /></button><span className="tf-task-copy"><b>{task.title}</b><small>{assignee?.full_name || "Non assignée"}{task.due_at ? ` · échéance ${new Date(task.due_at).toLocaleDateString("fr-FR")}` : ""}</small></span><span className={`tf-task-status ${task.status}`}>{task.status === "todo" ? "À faire" : task.status === "in_progress" ? "En cours" : task.status === "done" ? "Terminée" : "Annulée"}</span></div>; })}{!snapshot.tasks.length && <div className="tf-empty-cell">Aucune tâche. Créez une tâche et assignez-la à un membre.</div>}</div></div>
    {inviteOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { setInviteOpen(false); setInviteUrl(""); } }}><div className="modal-card"><div className="modal-top"><div><div className="eyebrow">ÉQUIPE · INVITATION SÉCURISÉE</div><h2>Inviter un membre</h2></div><button className="icon-button" onClick={() => { setInviteOpen(false); setInviteUrl(""); }}><X size={18} /></button></div>{inviteUrl ? <div className="modal-form"><p className="form-intro">Copiez ce lien et transmettez-le à <b>{inviteTargetEmail || "la personne invitée"}</b>. Il est à usage unique et expire dans 7 jours. Aucun e-mail n’est envoyé par TrafficFlow.</p><div className="tf-copy-link"><input readOnly value={inviteUrl} aria-label="Lien d’invitation" /><button className="btn-primary" onClick={() => { void navigator.clipboard.writeText(inviteUrl); toast.success("Lien copié"); }}><Copy size={15} /> Copier</button></div><div className="secure-note"><ShieldCheck size={15} /> Seule l’adresse e-mail invitée peut accepter ce lien.</div><div className="modal-actions"><button className="btn-primary" onClick={() => { setInviteOpen(false); setInviteUrl(""); }}>Terminé</button></div></div> : <form onSubmit={createInvite} className="modal-form"><label>Adresse e-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="va@exemple.fr" /></label><label>Rôle<select value={role} onChange={e => setRole(e.target.value as "va" | "manager" | "admin")}><option value="va">VA · accès limité aux comptes attribués</option><option value="manager">Manager · comptes et tâches attribués</option><option value="admin">Administrateur · gestion du Workspace</option></select></label>{role === "va" && <div className="tf-permission-checks"><b>Permissions du workspace</b>{permissionOptions.map(([key,label]) => <label key={key}><input type="checkbox" checked={Boolean(invitePermissions[key])} onChange={e => setInvitePermissions(old => ({ ...old, [key]: e.target.checked }))} />{label}</label>)}</div>}<div className="secure-note"><ShieldCheck size={15} /> Un VA ne verra que les comptes explicitement affectés.</div><div className="modal-actions"><button type="button" className="btn-quiet" onClick={() => setInviteOpen(false)}>Annuler</button><button className="btn-primary" disabled={invite.isPending}>{invite.isPending && <Loader2 className="spin" size={15} />}Créer le lien sécurisé <ArrowRight size={14} /></button></div></form>}</div></div>}
    {taskOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setTaskOpen(false); }}><div className="modal-card"><div className="modal-top"><div><div className="eyebrow">WORKSPACE · TÂCHE</div><h2>Assigner une tâche</h2></div><button className="icon-button" onClick={() => setTaskOpen(false)}><X size={18} /></button></div><form className="modal-form" onSubmit={e => { e.preventDefault(); createTask.mutate({ workspaceId: workspace.workspace_id, title: taskTitle, assigneeId: taskAssignee || null, accountId: taskAccount ? Number(taskAccount) : null }); }}><label>Titre<input required maxLength={200} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Ex. Préparer le carrousel de la semaine" /></label><label>Attribuer à<select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}><option value="">Moi / non assigné</option>{memberRows.filter(row => row.status === "active" && row.role !== "owner").map(row => <option key={row.user_id} value={row.user_id}>{row.profile?.full_name || row.profile?.email || row.role}</option>)}</select></label><label>Compte social<select value={taskAccount} onChange={e => setTaskAccount(e.target.value)}><option value="">Tous les comptes</option>{snapshot.accounts.map(account => <option key={account.id} value={account.id}>{account.platform} · {account.handle}</option>)}</select></label><div className="modal-actions"><button type="button" className="btn-quiet" onClick={() => setTaskOpen(false)}>Annuler</button><button className="btn-primary" disabled={!canManageTasks || createTask.isPending}>Créer la tâche <ArrowRight size={14} /></button></div></form></div></div>}
  </>;
}

function AssignmentPanel({ workspaceId, member, accounts, assignments, canManage, onAssign, onUnassign }: {
  workspaceId: string; member: WorkspaceSnapshot["members"][number] & { profile?: WorkspaceSnapshot["profiles"][number]; assignedAccounts: WorkspaceSnapshot["assignments"]; taskCount: number };
  accounts: WorkspaceSnapshot["accounts"]; assignments: WorkspaceSnapshot["assignments"]; canManage: boolean;
  onAssign: (accountId: number, permissions: Record<string, boolean>) => void; onUnassign: (accountId: number) => void;
}) {
  const activeAssignment = (accountId: number) => assignments.find(row => row.social_account_id === accountId);
  return <div className="tf-assignment-panel"><div><b>Affectations de {member.profile?.full_name || member.profile?.email || "ce membre"}</b><span>Ces autorisations par compte s’ajoutent au rôle VA.</span></div>{accounts.map(account => { const assignment = activeAssignment(account.id); const values = (assignment?.permissions ?? {}) as Record<string, boolean>; return <div className="tf-assignment-account" key={account.id}><label><input type="checkbox" checked={Boolean(assignment)} disabled={!canManage} onChange={e => e.target.checked ? onAssign(account.id, { view_content: true, create_content: true, edit_content: true, schedule: true, use_ai: true }) : onUnassign(account.id)} /><span><b>{account.platform} · {account.handle}</b><small>{account.display_name}</small></span></label>{assignment && <div className="tf-assignment-perms">{["view_content","create_content","edit_content","schedule","publish","view_interactions","use_ai","view_analytics"].map(key => <label key={key}><input type="checkbox" checked={Boolean(values[key])} disabled={!canManage} onChange={e => onAssign(account.id, { ...values, [key]: e.target.checked })} />{key.replaceAll("_", " ")}</label>)}</div>}</div>; })}{!accounts.length && <span className="tf-empty-cell">Ajoutez d’abord un compte social.</span>}</div>;
}

const planDescriptions: Record<string, string> = { free: "Pour découvrir TrafficFlow sans carte bancaire.", standard: "Pour les indépendants et petites équipes.", pro: "Pour les créateurs qui accélèrent.", business: "Pour les équipes et marques ambitieuses." };
function readSelectedPlan(): string | null { try { return window.localStorage.getItem("tf_selected_plan"); } catch { return null; } }
export function SubscriptionView({ workspace, snapshot, onRefresh }: { workspace: TrafficWorkspace; snapshot: WorkspaceSnapshot; onRefresh: () => void }) {
  const usage = snapshot.usage;
  const canManageBilling = Boolean(usage?.can_manage_billing);
  const scheduledPosts = snapshot.posts.filter(post => post.status === "scheduled").length;
  const activeMembers = snapshot.members.filter(member => member.status === "active").length;
  const activeAutomations = snapshot.workflows.filter(workflow => workflow.enabled).length;
  const currentPlan = usage?.plan_name ?? "Plan à vérifier";
  const trialDaysLabel = usage?.subscription_status === "trialing" && usage.trial_ends_at ? `Essai en cours jusqu’au ${new Date(usage.trial_ends_at).toLocaleDateString("fr-FR")}.` : "Aucune période d’essai active détectée.";
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: result => { window.location.assign(result.redirectUrl); },
    onError: error => toast.error(error.message),
  });
  const selectedPlan = readSelectedPlan();
  function choosePlan(code: "standard" | "pro" | "business") { checkout.mutate({ workspaceId: workspace.workspace_id, planCode: code, provider: "saspay" }); }
  return <><div className="section-heading"><div><div className="eyebrow">WORKSPACE · FACTURATION</div><h1>Abonnement</h1><p>Votre plan, vos limites et l’utilisation réelle de ce Workspace.</p></div><span className="tf-badge">{usage?.subscription_status?.toUpperCase() ?? "À VÉRIFIER"}</span></div>
    <div className="tf-billing-current"><div className="tf-billing-mark"><CreditCard size={20} /></div><div className="tf-billing-current-copy"><div className="eyebrow">PLAN ACTUEL</div><h2>{currentPlan} <span>{usage?.subscription_status === "trialing" ? "· Essai gratuit" : ""}</span></h2><p>{trialDaysLabel} Statut serveur : {usage?.subscription_status ?? "à vérifier"}. Aucun paiement n’est simulé.</p></div><div className="tf-billing-counters"><UsageCounter label="Comptes sociaux" used={Number(usage?.social_accounts_used ?? snapshot.accounts.length)} max={usage ? usage.social_account_limit : 0} /><UsageCounter label="Link Pages" used={Number(usage?.link_pages_used ?? 0)} max={usage ? usage.link_page_limit : 0} /><UsageCounter label="Membres actifs" used={Number(usage?.members_used ?? activeMembers)} max={usage ? usage.member_limit : 0} /><UsageCounter label="Messages IA" used={Number(usage?.ai_messages_used ?? 0)} max={usage ? usage.ai_message_limit : 0} /><UsageCounter label="Posts programmés" used={Number(usage?.scheduled_posts_used ?? scheduledPosts)} max={usage ? usage.scheduled_post_limit : 0} /><UsageCounter label="Automatisations" used={Number(usage?.automations_used ?? activeAutomations)} max={usage ? usage.automation_limit : 0} /></div></div>
    <div className="tf-info-banner"><ShieldCheck size={16} /><span>Utilisation affichée depuis les données du Workspace. Les limites d’accès restent contrôlées côté serveur par Supabase/RLS.</span></div>
    <div className="tf-plan-grid">{PLANS.map(plan => { const isCurrent = usage?.plan_code === plan.code; return <article key={plan.code} className={`tf-plan-card ${isCurrent ? "current" : ""} ${plan.code === "pro" ? "featured-plan" : ""}`}><div className="tf-plan-head"><span>{plan.name.toUpperCase()}</span>{plan.code === "pro" && <i className="featured">LE PLUS POPULAIRE</i>}{selectedPlan === plan.code && !isCurrent && <i className="featured">CHOISI</i>}</div><div className="tf-plan-price"><b>{plan.priceUsd === 0 ? "$0" : `$${plan.priceUsd}`}</b><span>{plan.priceUsd === 0 ? `${TRIAL_DAYS} jours d’essai` : "/ mois"}</span></div><p>{planDescriptions[plan.code]}</p><ul><li><Check size={14} />{plan.socialAccounts} comptes sociaux</li><li><Check size={14} />{plan.linkPages === null ? "Link Pages illimitées" : `${plan.linkPages} Link Page${plan.linkPages > 1 ? "s" : ""}`}</li><li><Check size={14} />{plan.members} membres</li><li><Check size={14} />{plan.virtualAssistants} sièges VA</li><li><Check size={14} />{plan.scheduledPosts.toLocaleString("fr-FR")} publications programmées</li><li><Check size={14} />{plan.aiMessages.toLocaleString("fr-FR")} messages IA / mois</li><li><Check size={14} />{plan.automations} automatisations</li>{plan.features.map(feature => <li key={feature}><Check size={14} />{feature}</li>)}<li><Check size={14} />Support : {plan.support}</li></ul>{plan.code === "free" ? <button className="btn-secondary tf-plan-button" disabled>{isCurrent ? "Forfait actuel" : "Inclus"}</button> : <button className={plan.code === "pro" ? "btn-primary tf-plan-button" : "btn-secondary tf-plan-button"} onClick={() => choosePlan(plan.code as "standard" | "pro" | "business")} disabled={isCurrent || !canManageBilling || checkout.isPending}>{isCurrent ? "Forfait actuel" : checkout.isPending ? "Un instant…" : "Choisir ce forfait"}<ArrowRight size={14} /></button>}</article>; })}</div>
    {snapshot.planRequests[0] && <div className="tf-info-banner"><Clock3 size={16} /> Demande existante : <b>{snapshot.planRequests[0].requested_plan.toUpperCase()}</b>. Le plan actuel reste inchangé tant qu’un fournisseur de paiement n’est pas configuré.</div>}
    <div className="tf-info-banner"><ShieldCheck size={16} /><span>Un forfait n’est activé qu’après confirmation du paiement par le fournisseur (webhook vérifié côté serveur). Si le paiement n’est pas encore configuré, le bouton vous l’indique et rien n’est débité.</span></div>
    {snapshot.subscriptionEvents.length > 0 && <div className="panel tf-team-panel"><div className="tf-panel-title"><div><h2>Historique d’abonnement</h2><p>Événements enregistrés par le système V2.</p></div></div>{snapshot.subscriptionEvents.map(event => <div className="tf-invite-row" key={event.id}><Clock3 size={14} /><b>{event.event_type.replaceAll("_", " ")}</b><span>{event.from_plan ?? "—"} → {event.to_plan ?? "—"}</span><small>{new Date(event.created_at).toLocaleString("fr-FR")}</small><i>{event.note}</i></div>)}</div>}
  </>;
}

function UsageCounter({ label, used, max, percent }: { label: string; used: number; max: number | null; percent?: number }) {
  const value = percent ?? (max ? Math.min(100, used / max * 100) : 0);
  return <div className="tf-counter"><span>{label}</span><b>{used.toLocaleString("fr-FR")}<small> / {max === null ? "∞" : max.toLocaleString("fr-FR")}</small></b><i><em style={{ width: `${value}%` }} /></i></div>;
}

export function CalendarV2View({ posts, accounts, members, profiles, month, setMonth, onNew }: {
  posts: WorkspaceSnapshot["posts"]; accounts: WorkspaceSnapshot["accounts"]; members: WorkspaceSnapshot["members"]; profiles: WorkspaceSnapshot["profiles"]; month: Date; setMonth: (date: Date) => void; onNew: () => void;
}) {
  const [mode, setMode] = useState<"day" | "week" | "month">("month");
  const [account, setAccount] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState("all");
  const [focus, setFocus] = useState(() => new Date());
  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1));
  }, [month]);
  const windowDays = useMemo(() => {
    if (mode === "month") return monthDays;
    const start = new Date(focus);
    if (mode === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: mode === "day" ? 1 : 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [mode, focus, monthDays]);
  const filtered = posts.filter(post => {
    const social = accounts.find(row => row.id === post.social_account_id);
    return (account === "all" || String(post.social_account_id) === account) && (platform === "all" || social?.platform === platform) && (assignee === "all" || post.assigned_to === assignee || (assignee === "unassigned" && !post.assigned_to)) && (status === "all" || post.status === status);
  });
  const changeFocus = (delta: number) => {
    const next = new Date(focus);
    next.setDate(next.getDate() + delta * (mode === "day" ? 1 : mode === "week" ? 7 : 30));
    setFocus(next);
    if (mode === "month") setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };
  const postsOn = (day: Date) => filtered.filter(post => post.scheduled_at && new Date(post.scheduled_at).toDateString() === day.toDateString());
  const heading = mode === "month" ? month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : mode === "day" ? focus.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : `${windowDays[0]?.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${windowDays[6]?.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  return <><div className="section-heading"><div><div className="eyebrow">PLANIFICATION ÉDITORIALE</div><h1>Calendrier</h1><p>Filtrez par compte, responsable et état de publication.</p></div><button className="btn-primary" onClick={onNew}><Plus size={15} /> Programmer un post</button></div>
    <div className="tf-calendar-controls"><div className="tf-calendar-nav"><button aria-label="Période précédente" onClick={() => changeFocus(-1)}><ChevronLeft size={16} /></button><b>{heading}</b><button aria-label="Période suivante" onClick={() => changeFocus(1)}><ChevronRight size={16} /></button><button onClick={() => { setFocus(new Date()); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(),1)); }}>Aujourd’hui</button></div><div className="tf-calendar-filters"><select aria-label="Filtrer par plateforme" value={platform} onChange={e => setPlatform(e.target.value)}><option value="all">Toutes les plateformes</option>{Array.from(new Set(accounts.map(row=>row.platform))).map(value=><option value={value} key={value}>{value}</option>)}</select><select aria-label="Filtrer par compte" value={account} onChange={e => setAccount(e.target.value)}><option value="all">Tous les comptes</option>{accounts.map(row => <option value={row.id} key={row.id}>{row.platform} · {row.handle}</option>)}</select><select aria-label="Filtrer par VA" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="all">Tous les responsables</option><option value="unassigned">Non assigné</option>{members.map(row => {const profile=profiles.find(item=>item.id===row.user_id);return <option key={row.user_id} value={row.user_id}>{profile?.full_name||profile?.email||row.role}</option>})}</select><select aria-label="Filtrer par statut" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Tous les statuts</option>{["draft","scheduled","processing","published","failed"].map(value => <option value={value} key={value}>{statusLabel(value)}</option>)}</select><div className="tf-mode-switch">{(["day","week","month"] as const).map(value => <button key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)}>{value === "day" ? "Jour" : value === "week" ? "Semaine" : "Mois"}</button>)}</div></div></div>
    <div className={`tf-calendar-grid ${mode}`}>{mode !== "day" && windowDays.map((day,index) => <div className="tf-calendar-weekday" key={`h${index}`}>{day.toLocaleDateString("fr-FR",{weekday:"short"})}</div>)}{windowDays.map((day,index) => <div key={day.toISOString()} className={`tf-calendar-cell ${mode === "month" && day.getMonth() !== month.getMonth() ? "outside" : ""} ${day.toDateString() === new Date().toDateString() ? "today" : ""}`}><span className="tf-calendar-date">{mode === "week" ? `${day.getDate()} · ${day.toLocaleDateString("fr-FR",{month:"short"})}` : day.getDate()}</span>{postsOn(day).map(post => { const social = accounts.find(row => row.id === post.social_account_id); const member = members.find(row => row.user_id === post.assigned_to || row.user_id === post.created_by); const profile=profiles.find(item=>item.id===(post.assigned_to??post.created_by)); return <article className={`tf-calendar-event ${post.status}`} key={post.id}><small>{new Date(post.scheduled_at!).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} · {social?.platform ?? "Sans compte"}</small><b>{post.title}</b><span>{profile?.full_name || profile?.email || (member ? member.role : "Aucun responsable assigné")}</span></article>; })}{mode === "month" && postsOn(day).length === 0 && <button className="tf-calendar-add" onClick={onNew}><Plus size={13} /> Ajouter</button>}{mode !== "month" && postsOn(day).length===0 && <span className="tf-calendar-empty">Rien de prévu</span>}</div>)}</div>
    <div className="tf-info-banner"><CalendarDays size={16} /><span>{filtered.length} publication(s) affichée(s). Les publications programmées sont traitées par le worker Vercel après configuration OAuth; le statut indique le résultat enregistré par TrafficFlow.</span></div>
  </>;
}

function statusLabel(value: string) { return ({draft:"Brouillon",scheduled:"Programmé",processing:"En cours",published:"Publié",failed:"Échec"} as Record<string,string>)[value] ?? value; }

export function LibraryControls({ workspaceId, snapshot, folder, setFolder, account, setAccount, creator, setCreator, type, setType, onRefresh }: {
  workspaceId: string; snapshot: WorkspaceSnapshot; folder: string; setFolder: (v: string) => void; account: string; setAccount: (v: string) => void; creator: string; setCreator: (v: string) => void; type: string; setType: (v: string) => void; onRefresh: () => void;
}) {
  const [newFolder, setNewFolder] = useState(false);
  const [name, setName] = useState("");
  const [historyMedia, setHistoryMedia] = useState<number|null>(null);
  const [history, setHistory] = useState<Database["public"]["Tables"]["media_history"]["Row"][]>([]);
  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase.from("media_folders").insert({ workspace_id: workspaceId, name: name.trim() });
    if (error) toast.error(error.message); else { toast.success("Dossier créé"); setName(""); setNewFolder(false); onRefresh(); }
  }
  async function showHistory(mediaId: number) {
    setHistoryMedia(mediaId);
    const { data, error } = await supabase.from("media_history").select("*").eq("workspace_id",workspaceId).eq("media_id",mediaId).order("created_at",{ascending:false}).limit(30);
    if (error) toast.error(error.message); else setHistory(data ?? []);
  }
  return <><div className="tf-library-controls"><label><FolderOpen size={14} /><select value={folder} onChange={e=>setFolder(e.target.value)}><option value="all">Tous les dossiers</option>{snapshot.folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label><Users size={14} /><select value={account} onChange={e=>setAccount(e.target.value)}><option value="all">Tous les comptes</option>{snapshot.accounts.map(a=><option key={a.id} value={a.id}>{a.platform} · {a.handle}</option>)}</select></label><label><Users size={14} /><select value={creator} onChange={e=>setCreator(e.target.value)}><option value="all">Tous les membres</option>{snapshot.profiles.map(p=><option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></label><label><FileText size={14} /><select value={type} onChange={e=>setType(e.target.value)}><option value="all">Tous les types</option><option value="image">Images</option><option value="video">Vidéos</option></select></label><button className="btn-small" onClick={()=>setNewFolder(true)}><Plus size={13}/> Nouveau dossier</button></div>
    {newFolder && <div className="tf-inline-create"><form onSubmit={createFolder}><input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Nom du dossier"/><button className="btn-small">Créer le dossier</button><button type="button" className="tf-text-button" onClick={()=>setNewFolder(false)}>Annuler</button></form></div>}
    <button className="tf-history-link" onClick={()=>{ const first=snapshot.media[0]; if(first) void showHistory(first.id); else toast.info("L’historique apparaîtra après une modification de média."); }}><Clock3 size={13}/> Historique des modifications</button>
    {historyMedia!==null && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setHistoryMedia(null)}}><div className="modal-card"><div className="modal-top"><div><div className="eyebrow">BIBLIOTHÈQUE · AUDIT</div><h2>Historique du média</h2></div><button className="icon-button" onClick={()=>setHistoryMedia(null)}><X size={18}/></button></div><div className="tf-history-list">{history.map(row=><div key={row.id}><Clock3 size={14}/><span><b>Version précédente</b><small>{new Date(row.created_at).toLocaleString("fr-FR")}</small></span><pre>{JSON.stringify(row.snapshot,null,2)}</pre></div>)}{!history.length&&<p>Aucun changement enregistré pour ce média.</p>}</div></div></div>}
  </>;
}

const triggerOptions = [["post_published","Publication réussie"],["post_failed","Échec de publication"],["task_done","Tâche terminée"],["new_comment","Nouveau commentaire"],["analytics_updated","Analytics actualisées"],["manual","Lancement manuel"]] as const;
const actionOptions = [["notify_va","Notifier le VA"],["notify_manager","Notifier le manager"],["suggest_reply","Proposer une réponse IA"],["refresh_analytics","Actualiser les analytics"],["manual","Journaliser uniquement"]] as const;

export function AutomationV2View({ workspaceId, snapshot, canManage, onRefresh }: { workspaceId: string; snapshot: WorkspaceSnapshot; canManage: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [actionType, setActionType] = useState("manual");
  const create = trpc.workspace.createWorkflow.useMutation({ onSuccess:()=>{toast.success("Règle enregistrée");setOpen(false);setName("");onRefresh()},onError:e=>toast.error(e.message) });
  const enable = trpc.workspace.setWorkflowEnabled.useMutation({ onSuccess:onRefresh,onError:e=>toast.error(e.message) });
  const runMap=new Map(snapshot.workflowRuns.map(run=>[run.workflow_id,run]));
  return <><div className="section-heading"><div><div className="eyebrow">TRIGGERS · CONDITIONS · ACTIONS</div><h1>Automatisations</h1><p>Configurez des règles transparentes et contrôlez leur état.</p></div><button className="btn-primary" disabled={!canManage} onClick={()=>setOpen(true)}><Plus size={15}/> Nouvelle règle</button></div>
    <div className="tf-info-banner"><ShieldCheck size={16}/><span>Les workflows sont sauvegardés et leurs plafonds sont contrôlés par Supabase. Le worker serverless est déclenché par le planificateur externe configuré pour votre déploiement. Aucun événement ou publication n’est simulé.</span></div>
    <div className="tf-workflow-grid">{snapshot.workflows.map(flow=><article className="panel tf-workflow-card" key={flow.id}><div className="tf-workflow-title"><div className="tf-workflow-icon"><Sparkles size={17}/></div><span><b>{flow.name}</b><small>{flow.enabled?"Règle activée":"Règle en pause"}</small></span><button className={`switch ${flow.enabled?"on":""}`} role="switch" aria-checked={flow.enabled} disabled={!canManage||enable.isPending} onClick={()=>enable.mutate({workspaceId,workflowId:flow.id,enabled:!flow.enabled})}><i/></button></div><div className="tf-workflow-steps"><span><small>DÉCLENCHEUR</small><b>{labelOption(triggerOptions,flow.trigger_type)}</b></span><ArrowRight size={14}/><span><small>ACTION</small><b>{labelOption(actionOptions,flow.action_type)}</b></span></div><div className="tf-workflow-footer"><span><Clock3 size={12}/> Créée le {new Date(flow.created_at).toLocaleDateString("fr-FR")}</span><span>{runMap.get(flow.id)?.status??"Aucune exécution"}</span></div></article>)}{!snapshot.workflows.length&&<div className="panel tf-workflow-empty"><div className="tf-workflow-icon"><Sparkles size={18}/></div><b>Pas encore de règle</b><span>Choisissez un événement et une action, puis activez la règle quand le worker sera connecté.</span><button className="btn-secondary" disabled={!canManage} onClick={()=>setOpen(true)}><Plus size={14}/> Créer ma première règle</button></div>}</div>
    <div className="panel tf-team-panel"><div className="tf-panel-title"><div><h2>Journal des exécutions</h2><p>Historique des workers et erreurs enregistrées dans la file.</p></div><span className="tf-badge">{snapshot.workflowRuns.length} ENREGISTREMENTS</span></div><div className="tf-run-list">{snapshot.workflowRuns.map(run=><div key={run.id} className="tf-run-row"><span className={`tf-run-dot ${run.status}`}/><b>{snapshot.workflows.find(flow=>flow.id===run.workflow_id)?.name??"Exécution sans règle"}</b><span>{run.status}</span><small>{new Date(run.created_at).toLocaleString("fr-FR")}</small>{run.error_message&&<i>{run.error_message}</i>}</div>)}{!snapshot.workflowRuns.length&&<div className="tf-empty-cell">Aucune exécution enregistrée. Le worker d’automatisation n’est pas configuré.</div>}</div></div>
    {open&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div className="modal-card"><div className="modal-top"><div><div className="eyebrow">WORKFLOW · CONFIGURATION</div><h2>Créer une règle</h2></div><button className="icon-button" onClick={()=>setOpen(false)}><X size={18}/></button></div><form className="modal-form" onSubmit={e=>{e.preventDefault();create.mutate({workspaceId,name,triggerType:triggerType as "post_published"|"post_failed"|"task_done"|"new_comment"|"analytics_updated"|"manual",actionType:actionType as "notify_va"|"notify_manager"|"suggest_reply"|"refresh_analytics"|"manual",condition:{},actionConfig:{}})}}><label>Nom<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Alerter le manager en cas d’échec"/></label><label>Déclencheur<select value={triggerType} onChange={e=>setTriggerType(e.target.value)}>{triggerOptions.map(([code,label])=><option value={code} key={code}>{label}</option>)}</select></label><label>Action<select value={actionType} onChange={e=>setActionType(e.target.value)}>{actionOptions.map(([code,label])=><option value={code} key={code}>{label}</option>)}</select></label><div className="secure-note"><ShieldCheck size={15}/>La règle reste désactivée jusqu’à activation explicite. Le planificateur externe doit être configuré pour exécuter les publications et leurs automatisations.</div><div className="modal-actions"><button className="btn-quiet" type="button" onClick={()=>setOpen(false)}>Annuler</button><button className="btn-primary" disabled={create.isPending}>Enregistrer la règle <ArrowRight size={14}/></button></div></form></div></div>}
  </>;
}
function labelOption(options: readonly (readonly [string,string])[], value: string) { return options.find(([key])=>key===value)?.[1]??value.replaceAll("_"," "); }

export function NotificationsV2View({snapshot,userId,onRefresh}:{snapshot:WorkspaceSnapshot;userId:string;onRefresh:()=>void}) {
  const rows=snapshot.notifications.filter(row=>!row.user_id||row.user_id===userId);
  async function markRead(id:string) {
    const {error}=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id);
    if(error)toast.error(error.message);else onRefresh();
  }
  return <><div className="section-heading"><div><div className="eyebrow">ESPACE · ALERTES</div><h1>Notifications</h1><p>Invitations, limites, tâches et intégrations, rattachées au Workspace.</p></div><span className="tf-badge">{rows.filter(row=>!row.read_at).length} NON LUES</span></div><div className="panel tf-team-panel"><div className="tf-notification-list">{rows.map(row=><article key={row.id} className={`tf-notification-row ${row.read_at?"read":"unread"}`}><span className="tf-notification-icon"><Bell size={16}/></span><div><b>{row.title}</b><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString("fr-FR")}</small></div>{!row.read_at&&<button className="tf-text-button" onClick={()=>void markRead(row.id)}>Marquer comme lue</button>}</article>)}{!rows.length&&<div className="tf-empty-cell">Rien à signaler pour le moment.</div>}</div></div></>;
}

export function WorkspaceSettingsView({workspace,user,onRefresh,onLogout}:{workspace:TrafficWorkspace;user:{id:string;name:string|null;email:string|null};onRefresh:()=>void;onLogout:()=>void}) {
  const [workspaceName,setWorkspaceName]=useState(workspace.workspace_name);
  const [fullName,setFullName]=useState(user.name??"");
  const [saving,setSaving]=useState(false);
  async function save(event:FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const {error:profileError}=await supabase.from("profiles").update({full_name:fullName.trim()}).eq("id",user.id);
      if(profileError)throw profileError;
      const {error:authError}=await supabase.auth.updateUser({data:{full_name:fullName.trim()}});
      if(authError)throw authError;
      const {error:workspaceError}=await supabase.from("workspaces").update({name:workspaceName.trim()}).eq("id",workspace.workspace_id);
      if(workspaceError)throw workspaceError;
      toast.success("Profil et Workspace enregistrés"); onRefresh();
    } catch(error) {toast.error(error instanceof Error?error.message:"Enregistrement impossible")} finally {setSaving(false)}
  }
  const canRename = workspace.role === "owner" || workspace.role === "admin";
  return <><div className="section-heading"><div><div className="eyebrow">WORKSPACE · PRÉFÉRENCES</div><h1>Paramètres</h1><p>Profil, Workspace, sécurité, intégrations et abonnement.</p></div></div><div className="tf-settings-grid"><form className="panel tf-settings-card" onSubmit={save}><span className="tf-settings-icon"><Users size={18}/></span><div className="eyebrow">PROFIL & WORKSPACE</div><h2>Identité de votre espace</h2><label>Nom complet<input maxLength={80} value={fullName} onChange={e=>setFullName(e.target.value)} required/></label><div className="tf-readonly"><Mail size={14}/><span>{user.email??"Adresse e-mail non disponible"}</span><small>géré par Supabase Auth</small></div><label>Nom du Workspace<input maxLength={100} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} required disabled={!canRename}/></label><button className="btn-primary" disabled={saving}>{saving&&<Loader2 className="spin" size={14}/>}Enregistrer les changements</button></form><div className="panel tf-settings-card"><span className="tf-settings-icon amber"><KeyRound size={18}/></span><div className="eyebrow">SÉCURITÉ</div><h2>Session Supabase Auth</h2><p>Votre session est validée sur le serveur à partir du JWT Supabase. Les données sont cloisonnées par Workspace avec PostgreSQL RLS.</p><div className="tf-security-list"><span><ShieldCheck size={15}/>Clé publishable uniquement dans le navigateur</span><span><Lock size={15}/>Aucune clé service_role dans l’application</span><span><BadgeCheck size={15}/>Tokens sociaux chiffrés côté serveur après autorisation</span></div><button className="btn-secondary" onClick={onLogout}><KeyRound size={14}/> Se déconnecter de cet appareil</button></div><div className="panel tf-settings-card"><span className="tf-settings-icon mint"><CreditCard size={18}/></span><div className="eyebrow">ABONNEMENT</div><h2>{workspace.plan_code.toUpperCase()} · {workspace.subscription_status}</h2><p>{workspace.trial_ends_at?`Essai courant jusqu’au ${new Date(workspace.trial_ends_at).toLocaleDateString("fr-FR")}.`:"Les plans et leurs limites sont visibles sur la page Abonnement."}</p><a className="btn-small" href="/abonnement">Gérer le plan <ArrowRight size={13}/></a></div><div className="panel tf-settings-card"><span className="tf-settings-icon lavender"><Sparkles size={18}/></span><div className="eyebrow">INTÉGRATIONS SOCIALES</div><h2>Connexions officielles</h2><p>Les sept parcours OAuth et les scopes Analytics sont préparés. Leur activation réelle dépend des applications, accès et validations de chaque réseau.</p><div className="tf-security-list"><span><BadgeCheck size={15}/>Instagram, Facebook, TikTok, YouTube, Threads, LinkedIn et X : OAuth à configurer</span><span><Clock3 size={15}/>Analytics : collecte serveur à activer par connecteur</span></div></div></div></>;
}
