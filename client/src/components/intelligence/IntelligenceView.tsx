import { Activity, BarChart3, Download, FileText, Users } from "lucide-react";
import { SOCIAL_PLATFORM_COLORS, SocialPlatformIcon, type SocialPlatform } from "@/components/SocialPlatformIcon";
import { isSupportedSocialPlatform } from "@shared/social-platforms";
import type { WorkspaceSnapshot } from "@/lib/workspace-data";

type Props = { snapshot: WorkspaceSnapshot };

export default function IntelligenceView({ snapshot }: Props) {
  const accounts = snapshot.accounts.filter(account => isSupportedSocialPlatform(account.platform));
  const accountCount = accounts.length;
  const referenceFollowers = accounts.reduce((sum, account) => sum + Number(account.followers ?? 0), 0);
  const declaredEngagement = accountCount
    ? accounts.reduce((sum, account) => sum + Number(account.engagement_rate ?? 0), 0) / accountCount
    : 0;
  const byPlatform = Array.from(new Set(accounts.map(account => account.platform))).map(platform => {
    const profiles = accounts.filter(account => account.platform === platform);
    return {
      platform,
      accounts: profiles.length,
      followers: profiles.reduce((sum, account) => sum + Number(account.followers ?? 0), 0),
      engagement: profiles.length ? profiles.reduce((sum, account) => sum + Number(account.engagement_rate ?? 0), 0) / profiles.length : 0,
    };
  }).sort((a, b) => b.followers - a.followers);
  const posts = {
    total: snapshot.posts.length,
    drafts: snapshot.posts.filter(post => post.status === "draft").length,
    scheduled: snapshot.posts.filter(post => post.status === "scheduled").length,
    markedPublished: snapshot.posts.filter(post => post.status === "published").length,
  };
  const now = Date.now();
  const currentPeriodStart = now - 30 * 24 * 60 * 60 * 1000;
  const previousPeriodStart = now - 60 * 24 * 60 * 60 * 1000;
  const createdAt = (post: WorkspaceSnapshot["posts"][number]) => new Date(post.created_at).getTime();
  const recentPostCount = snapshot.posts.filter(post => createdAt(post) >= currentPeriodStart).length;
  const previousPostCount = snapshot.posts.filter(post => createdAt(post) >= previousPeriodStart && createdAt(post) < currentPeriodStart).length;
  const periodDelta = recentPostCount - previousPostCount;
  const onlineAccounts = accounts.filter(account => account.connection_status === "connected").length;

  function exportReport() {
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Section", "Plateforme/compte", "Mesure", "Valeur", "Période/source"],
      ...byPlatform.map(row => ["Comptes", row.platform, "Abonnés de référence", String(row.followers), "Valeurs du Workspace, non synchronisées"]),
      ...byPlatform.map(row => ["Comptes", row.platform, "Engagement déclaré moyen (%)", row.engagement.toFixed(2), "Valeurs du Workspace, non synchronisées"]),
      ["Contenus", "Tous", "Créés sur les 30 derniers jours", String(recentPostCount), "created_at TrafficFlow"],
      ["Contenus", "Tous", "Créés sur les 30 jours précédents", String(previousPostCount), "created_at TrafficFlow"],
      ...snapshot.posts.map(post => ["Publication", post.title, post.status, post.created_at, "Statut interne uniquement"]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(quote).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `trafficflow-intelligence-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className="tf-intelligence-view">
    <header className="tf-product-hero"><span className="tf-product-hero-icon intel"><BarChart3 size={21} /></span><div><div className="eyebrow">TRAFFICFLOW INTELLIGENCE</div><h1>Comprendre vos données disponibles</h1><p>Comparaisons calculées à partir des valeurs et événements enregistrés dans votre Workspace.</p></div><button className="btn-secondary" onClick={exportReport}><Download size={15} />Exporter CSV</button></header>
    <div className="tf-product-metrics">
      <article><span>Comptes suivis ici</span><strong>{accountCount}</strong><small>Fiches actives du catalogue actuel</small></article>
      <article><span>Abonnés de référence</span><strong>{referenceFollowers.toLocaleString("fr-FR")}</strong><small>Valeurs saisies ou importées, non synchronisées</small></article>
      <article><span>Engagement déclaré moyen</span><strong>{declaredEngagement.toFixed(1)}%</strong><small>Moyenne des valeurs associées aux fiches</small></article>
      <article><span>Publications créées · 30 jours</span><strong>{recentPostCount}</strong><small>Vs {previousPostCount} sur les 30 jours précédents · écart {periodDelta > 0 ? "+" : ""}{periodDelta}</small></article>
    </div>
    <div className="tf-intelligence-grid">
      <section className="panel tf-product-panel"><div className="tf-product-panel-head"><div><div className="eyebrow">COMPARAISON PAR PLATEFORME</div><h2>Répartition des comptes</h2></div><Users size={17} /></div>
        {byPlatform.length ? <div className="tf-intelligence-platform-list">{byPlatform.map(row => { const platform = isSupportedSocialPlatform(row.platform) ? row.platform as SocialPlatform : null; const color = platform ? SOCIAL_PLATFORM_COLORS[platform] : "#7564e4"; return <article key={row.platform}><span className="tf-intelligence-brand">{platform ? <SocialPlatformIcon platform={platform} size={17} style={{ color }} /> : <Activity size={16} />}</span><div className="tf-intelligence-platform-main"><b>{row.platform}</b><small>{row.accounts} compte(s) · {row.followers.toLocaleString("fr-FR")} abonnés de référence</small></div><strong>{row.engagement.toFixed(1)}%</strong></article>; })}</div> : <div className="tf-product-empty"><Users size={20} /><b>Aucun compte à comparer</b><span>Ajoutez des fiches de comptes pour afficher leur répartition.</span></div>}
      </section>
      <section className="panel tf-product-panel"><div className="tf-product-panel-head"><div><div className="eyebrow">FLUX DE CONTENU</div><h2>États enregistrés</h2></div><FileText size={17} /></div>
        <div className="tf-intelligence-status"><span>Brouillons</span><b>{posts.drafts}</b></div>
        <div className="tf-intelligence-status"><span>Programmations conservées</span><b>{posts.scheduled}</b></div>
        <div className="tf-intelligence-status"><span>Éléments au statut « publié »</span><b>{posts.markedPublished}</b></div>
        <div className="tf-intelligence-status"><span>Comptes avec connexion confirmée dans TrafficFlow</span><b>{onlineAccounts} / {accountCount}</b></div>
        <p className="tf-product-disclaimer">Le statut « publié » est le statut enregistré dans TrafficFlow; il ne prouve pas une publication sur un réseau social.</p>
      </section>
    </div>
    <div className="tf-product-disclaimer tf-intelligence-disclaimer"><strong>Limites des données :</strong> la comparaison de périodes porte uniquement sur la date de création interne des contenus. Les impressions, interactions, croissance, contenus les plus performants et recommandations fondées sur des APIs sociales ne sont pas disponibles tant que les connecteurs officiels ne sont pas configurés et testés.</div>
  </section>;
}
