import { ArrowRight, CalendarDays, FilePlus2, Instagram, Link2, Users } from "lucide-react";

export type ModeHomeProps = {
  accountCount: number;
  draftCount: number;
  scheduledCount: number;
  onNavigate: (view: "accounts" | "calendar" | "link-pages") => void;
  onNewDraft: () => void;
};

export default function ModeHome({ accountCount, draftCount, scheduledCount, onNavigate, onNewDraft }: ModeHomeProps) {
  return <section className="tf-simple-home" aria-labelledby="simple-home-title">
    <header className="tf-simple-hero">
      <div>
        <div className="eyebrow">MODE SIMPLE · VOTRE ESPACE</div>
        <h1 id="simple-home-title">On avance à votre rythme.</h1>
        <p>Retrouvez l’essentiel pour organiser vos comptes, préparer vos contenus et garder le cap.</p>
      </div>
      <div className="tf-simple-hero-mark"><Instagram size={27} /></div>
    </header>

    <div className="tf-simple-stats" aria-label="Résumé de votre Workspace">
      <article><span>Comptes enregistrés</span><strong>{accountCount}</strong><small>Fiches dans ce Workspace</small></article>
      <article><span>Brouillons</span><strong>{draftCount}</strong><small>À relire ou compléter</small></article>
      <article><span>Posts programmés</span><strong>{scheduledCount}</strong><small>Enregistrés dans TrafficFlow</small></article>
    </div>

    <div className="tf-simple-section-heading"><div><div className="eyebrow">VOS PROCHAINES ÉTAPES</div><h2>Que souhaitez-vous faire ?</h2></div></div>
    <div className="tf-simple-actions">
      <button type="button" className="tf-simple-action" onClick={() => onNavigate("accounts")}><span className="tf-simple-action-icon violet"><Users size={19} /></span><strong>Gérer mes comptes</strong><small>Consulter ou ajouter une fiche de compte</small><ArrowRight size={16} /></button>
      <button type="button" className="tf-simple-action" onClick={onNewDraft}><span className="tf-simple-action-icon mint"><FilePlus2 size={19} /></span><strong>Préparer un brouillon</strong><small>Écrire et enregistrer un contenu à relire</small><ArrowRight size={16} /></button>
      <button type="button" className="tf-simple-action" onClick={() => onNavigate("calendar")}><span className="tf-simple-action-icon amber"><CalendarDays size={19} /></span><strong>Voir mon calendrier</strong><small>Retrouver les posts enregistrés et planifiés</small><ArrowRight size={16} /></button>
      <button type="button" className="tf-simple-action" onClick={() => onNavigate("link-pages")}><span className="tf-simple-action-icon blue"><Link2 size={19} /></span><strong>Ouvrir mes Link Pages</strong><small>Gérer mes pages et liens publics</small><ArrowRight size={16} /></button>
    </div>
    <div className="tf-simple-honesty-note"><strong>À savoir :</strong> les comptes ajoutés restent des fiches à connecter. L’OAuth social et la publication externe ne sont pas activés par ce tableau de bord.</div>
  </section>;
}
