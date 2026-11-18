import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, Download, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceSnapshot } from "@/lib/workspace-data";
import { trpc } from "@/lib/trpc";

type Props = {
  snapshot: WorkspaceSnapshot;
  workspaceId: string;
  effectivePlan: string | null;
  canDecide: boolean;
  currentUserId: string;
  onRefresh: () => void | Promise<void>;
  onOpenTeam: () => void;
  onOpenPosts: () => void;
};

export default function BusinessView({ snapshot, workspaceId, effectivePlan, canDecide, currentUserId, onRefresh, onOpenTeam, onOpenPosts }: Props) {
  const activeMembers = snapshot.members.filter(member => member.status === "active");
  const openTasks = snapshot.tasks.filter(task => !["done", "cancelled"].includes(task.status));
  const doneTasks = snapshot.tasks.filter(task => task.status === "done");
  const now = Date.now();
  const pendingInvitations = snapshot.invitations.filter(invitation => !invitation.accepted_at && !invitation.revoked_at && new Date(invitation.expires_at).getTime() > now);
  const profiles = new Map(snapshot.profiles.map(profile => [profile.id, profile]));
  const utils = trpc.useUtils();
  const approvalQuery = trpc.approvals.list.useQuery({ workspaceId }, { enabled: Boolean(workspaceId && effectivePlan === "business"), retry: false });
  const decideApproval = trpc.approvals.decide.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success(variables.decision === "approved" ? "Contenu approuvé et programmé" : "Demande refusée");
      await utils.approvals.list.invalidate({ workspaceId: variables.workspaceId });
      await onRefresh();
    },
    onError: error => toast.error(error.message),
  });
  const approvals = approvalQuery.data ?? [];
  function exportReport() {
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [["Type", "Élément", "État", "Échéance/date", "Responsable/détail"]];
    snapshot.tasks.forEach(task => lines.push(["Tâche", task.title, task.status, task.due_at ?? "", task.assigned_to ? profiles.get(task.assigned_to)?.full_name ?? "Attribuée" : "Non attribuée"]));
    snapshot.posts.forEach(post => lines.push(["Publication", post.title, post.status, post.scheduled_at ?? post.created_at, "Donnée TrafficFlow; aucune confirmation de réseau social"]));
    approvals.forEach(row => { const data = row.post_snapshot as Record<string, unknown>; lines.push(["Approbation", typeof data.title === "string" ? data.title : "Publication", row.status, row.requested_scheduled_at, row.decision_note || row.request_note]); });
    const csv = `\uFEFF${lines.map(line => line.map(quote).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `trafficflow-business-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
    toast.success("Rapport instantané exporté");
  }

  return <section className="tf-business-view">
    <header className="tf-product-hero"><span className="tf-product-hero-icon"><BriefcaseBusiness size={21} /></span><div><div className="eyebrow">TRAFFICFLOW BUSINESS</div><h1>Coordonnez votre Workspace</h1><p>Suivez les collaborateurs, invitations et demandes de validation qui existent réellement dans cet espace.</p></div><div className="tf-business-hero-actions"><button className="btn-secondary" onClick={exportReport}><Download size={15} />Exporter CSV</button><button className="btn-primary" onClick={onOpenTeam}><Users size={15} />Ouvrir l’équipe <ArrowRight size={14} /></button></div></header>
    <div className="tf-product-metrics">
      <article><span>Membres actifs</span><strong>{activeMembers.length}</strong><small>Rôles et accès gérés par le Workspace</small></article>
      <article><span>Tâches ouvertes</span><strong>{openTasks.length}</strong><small>Enregistrées dans TrafficFlow</small></article>
      <article><span>Tâches terminées</span><strong>{doneTasks.length}</strong><small>Statut interne de tâche</small></article>
      <article><span>Invitations en attente</span><strong>{pendingInvitations.length}</strong><small>Visibles selon vos droits</small></article>
    </div>
    <div className="tf-business-grid">
      <section className="panel tf-product-panel"><div className="tf-product-panel-head"><div><div className="eyebrow">RESPONSABILITÉS</div><h2>Activité de l’équipe</h2></div><button className="text-action" onClick={onOpenTeam}>Gérer l’équipe <ArrowRight size={13} /></button></div>
        {openTasks.length ? <div className="tf-business-task-list">{openTasks.slice(0, 6).map(task => { const profile = task.assigned_to ? profiles.get(task.assigned_to) : null; return <article key={task.id}><span className="tf-business-task-icon"><Clock3 size={15} /></span><div><b>{task.title}</b><small>{profile?.full_name || profile?.email || "Non attribuée"}{task.due_at ? ` · Échéance ${new Date(task.due_at).toLocaleDateString("fr-FR")}` : " · Sans échéance"}</small></div><span className="tf-business-status">{task.status}</span></article>; })}</div> : <div className="tf-product-empty"><CheckCircle2 size={19} /><b>Aucune tâche ouverte</b><span>Les tâches apparaîtront ici après leur création dans le module Équipe.</span></div>}
      </section>
      <section className="panel tf-product-panel"><div className="tf-product-panel-head"><div><div className="eyebrow">CONTENUS</div><h2>Coordination éditoriale</h2></div><button className="text-action" onClick={onOpenPosts}>Ouvrir les publications <ArrowRight size={13} /></button></div>
        <div className="tf-business-content-row"><span>Brouillons</span><b>{snapshot.posts.filter(post => post.status === "draft").length}</b></div>
        <div className="tf-business-content-row"><span>Programmations enregistrées</span><b>{snapshot.posts.filter(post => post.status === "scheduled").length}</b></div>
        <div className="tf-business-content-row"><span>Demandes en attente</span><b>{effectivePlan === "business" ? approvals.filter(row => row.status === "pending").length : "Business"}</b></div>
        <div className="tf-product-disclaimer"><strong>Règle de programmation :</strong> sur le forfait Business, tout passage à « programmé » exige une demande approuvée par une autre personne Owner/Admin/Manager. Le contrôle est appliqué dans la base; l’approbation ne publie rien sur un réseau social.</div>
      </section>
    </div>
    <section className="panel tf-product-panel tf-approval-panel">
      <div className="tf-product-panel-head"><div><div className="eyebrow">VALIDATION PRÉALABLE</div><h2>Demandes d’approbation</h2></div><span className="tf-business-status">{effectivePlan === "business" ? `${approvals.filter(row => row.status === "pending").length} en attente` : "Forfait Business requis"}</span></div>
      {effectivePlan !== "business" ? <div className="tf-product-empty"><BriefcaseBusiness size={19} /><b>Workflow réservé au forfait Business</b><span>Le verrouillage des programmations est vérifié côté base de données selon le forfait effectif.</span></div>
        : approvalQuery.isLoading ? <div className="tf-product-empty"><Clock3 size={19} /><span>Chargement de la file de validation…</span></div>
        : approvalQuery.error ? <div className="tf-product-empty"><XCircle size={19} /><b>File indisponible</b><span>Vérifiez que la migration 0014 est appliquée et que vos droits Workspace sont actifs.</span></div>
        : approvals.length ? <div className="tf-approval-list">{approvals.map(row => {
          const snapshot = row.post_snapshot as Record<string, unknown>;
          const title = typeof snapshot.title === "string" ? snapshot.title : "Publication";
          const isSelf = row.requested_by === currentUserId;
          const canAct = row.status === "pending" && canDecide && !isSelf;
          return <article className="tf-approval-row" key={row.id}>
            <div className="tf-approval-copy"><b>{title}</b><span>Demandé pour {new Date(row.requested_scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {row.status === "pending" ? "En attente" : row.status === "approved" ? "Approuvé" : "Refusé"}</span>{row.request_note && <small>{row.request_note}</small>}{row.decision_note && <small>Décision : {row.decision_note}</small>}{isSelf && row.status === "pending" && <small>Vous avez soumis cette demande; une autre personne responsable doit décider.</small>}</div>
            {canAct && <div className="tf-approval-actions"><button className="btn-secondary" disabled={decideApproval.isPending} onClick={() => decideApproval.mutate({ workspaceId, requestId: row.id, decision: "rejected" })}><XCircle size={14} /> Refuser</button><button className="btn-primary" disabled={decideApproval.isPending} onClick={() => decideApproval.mutate({ workspaceId, requestId: row.id, decision: "approved" })}><CheckCircle2 size={14} /> Approuver & programmer</button></div>}
          </article>;
        })}</div> : <div className="tf-product-empty"><CheckCircle2 size={19} /><b>Aucune demande en attente</b><span>Les brouillons Business soumis à une programmation apparaîtront ici.</span></div>}
    </section>
  </section>;
}
