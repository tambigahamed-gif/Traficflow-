import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_MODE_DETAILS, APP_MODES, type AppMode } from "@/lib/app-mode";
import { useAppMode } from "@/contexts/AppModeContext";
import { isOnboardingComplete, ONBOARDING_GOALS, ONBOARDING_PLATFORMS, saveOnboardingPreferences } from "@/lib/onboarding-storage";

const MODE_AUDIENCE: Record<AppMode, string> = {
  simple: "Débutants, indépendants et petites activités",
  creator: "Créateurs, influenceurs et responsables de plusieurs comptes",
  professional: "Équipes, agences et entreprises",
};

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const { setMode } = useAppMode();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [mode, setSelectedMode] = useState<AppMode>("simple");
  const [activity, setActivity] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/connexion?next=%2Fonboarding");
  }, [loading, user, setLocation]);

  useEffect(() => {
    if (user && isOnboardingComplete(user.id)) setLocation("/dashboard");
  }, [user, setLocation]);

  const stepLabels = useMemo(() => ["Votre expérience", "Votre activité", "Vos plateformes"], []);

  function toggleValue(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  }

  function finish() {
    if (!user) return;
    setSaving(true);
    const saved = saveOnboardingPreferences(user.id, {
      mode,
      activity: activity.trim(),
      goals,
      platforms,
      completedAt: new Date().toISOString(),
    });
    setMode(mode);
    setSaving(false);
    if (!saved) {
      setLocation("/dashboard");
      return;
    }
    setLocation("/dashboard");
  }

  if (loading || !user) return <main className="tf-onboarding-loading"><Loader2 className="spin" size={22} /><span>Vérification de votre session…</span></main>;

  return <main className="tf-onboarding-page">
    <section className="tf-onboarding-card" aria-labelledby="onboarding-title">
      <div className="tf-onboarding-brand"><BrandMark large /><span className="brand-word">traffic<span>flow</span></span></div>
      <div className="tf-onboarding-progress" aria-label={`Étape ${step + 1} sur 3`}>
        {stepLabels.map((label, index) => <div className={`tf-onboarding-step ${index === step ? "active" : index < step ? "done" : ""}`} key={label}><span>{index < step ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}
      </div>
      {step === 0 && <>
        <div className="eyebrow">PERSONNALISATION · 1/3</div>
        <h1 id="onboarding-title">Choisissez votre espace de travail</h1>
        <p className="tf-onboarding-intro">Le mode change uniquement la présentation et les raccourcis. Il ne modifie pas les rôles, les permissions, les quotas ni les données de votre Workspace.</p>
        <div className="tf-mode-cards">
          {APP_MODES.map(item => <button type="button" key={item} className={`tf-mode-card ${mode === item ? "selected" : ""}`} aria-pressed={mode === item} onClick={() => setSelectedMode(item)}><span className="tf-mode-card-icon"><Sparkles size={18} /></span><strong>{APP_MODE_DETAILS[item].label}</strong><small>{MODE_AUDIENCE[item]}</small><p>{APP_MODE_DETAILS[item].summary}</p></button>)}
        </div>
      </>}
      {step === 1 && <>
        <div className="eyebrow">VOTRE CONTEXTE · 2/3</div>
        <h1 id="onboarding-title">Parlez-nous de votre activité</h1>
        <p className="tf-onboarding-intro">Ces préférences servent à préparer votre expérience. Elles ne sont pas encore envoyées aux assistants IA.</p>
        <label className="tf-onboarding-field">Votre activité ou votre secteur<input value={activity} onChange={event => setActivity(event.target.value)} maxLength={100} placeholder="Ex. boutique de vêtements, coach sportif…" /></label>
        <fieldset className="tf-onboarding-options"><legend>Vos objectifs principaux</legend>{ONBOARDING_GOALS.map(goal => <label key={goal} className="tf-onboarding-option"><input type="checkbox" checked={goals.includes(goal)} onChange={() => toggleValue(goals, goal, setGoals)} /><span>{goal}</span></label>)}</fieldset>
      </>}
      {step === 2 && <>
        <div className="eyebrow">VOS RÉSEAUX · 3/3</div>
        <h1 id="onboarding-title">Quels réseaux utilisez-vous ?</h1>
        <p className="tf-onboarding-intro">Sélectionner un réseau ne connecte aucun compte. Les connexions OAuth et la publication restent soumises à la configuration officielle de chaque plateforme.</p>
        <div className="tf-onboarding-platforms">{ONBOARDING_PLATFORMS.map(platform => <label className={`tf-platform-choice ${platforms.includes(platform) ? "selected" : ""}`} key={platform}><input type="checkbox" checked={platforms.includes(platform)} onChange={() => toggleValue(platforms, platform, setPlatforms)} /><span>{platform}</span></label>)}</div>
        <div className="tf-onboarding-note"><CheckCircle2 size={16} />Vos choix sont enregistrés dans ce navigateur, associés à votre compte. Aucune donnée n’est écrite dans Supabase par cet onboarding.</div>
      </>}
      <div className="tf-onboarding-actions">
        {step > 0 ? <button className="btn-quiet" type="button" onClick={() => setStep(value => value - 1)}><ArrowLeft size={15} /> Retour</button> : <button className="btn-quiet" type="button" onClick={() => setLocation("/dashboard")}>Passer pour l’instant</button>}
        {step < 2 ? <button className="btn-primary" type="button" onClick={() => setStep(value => value + 1)}>Continuer <ArrowRight size={15} /></button> : <button className="btn-primary" type="button" onClick={finish} disabled={saving}>{saving ? <Loader2 className="spin" size={15} /> : <Check size={15} />}Terminer et ouvrir le dashboard</button>}
      </div>
    </section>
    <p className="tf-onboarding-footer">TrafficFlow adapte l’interface à votre profil. La sécurité des Workspaces reste appliquée de la même manière.</p>
  </main>;
}
