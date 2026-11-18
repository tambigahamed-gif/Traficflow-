# TrafficFlow V2 — guide de lancement

Cette archive correspond à la base **TrafficFlow V2 stable**, enrichie avec les Tranches 1 à 3 validées : landing publique, authentification Supabase, Link Pages et Social Control Center.

> **Attention — document historique V2.** Pour l’archive TrafficFlow FINAL, suivre `GUIDE-DEPLOIEMENT-FINAL-FR.md`. Le propriétaire indique que la migration `0012_plans_v3_billing.sql` est déjà appliquée : ne pas la réexécuter. Ne pas appliquer une migration sans avoir d’abord vérifié l’historique réel du projet Supabase cible.

> **Périmètre social courant :** Messenger est retiré des plateformes proposées. Les fiches historiques restent conservées; ce changement ne touche pas à la messagerie interne TrafficFlow. La liste courante est documentée dans le guide FINAL.

## Fonctionnalités disponibles

- Landing publique TrafficFlow sur `/` avec hero, fonctionnalités, Link Pages, IA, automatisations, équipe, analytics, tarifs, FAQ, CTA, support et responsive mobile.
- Authentification Supabase par e-mail, inscription, confirmation, mot de passe oublié, récupération et Google OAuth lorsque le fournisseur est configuré.
- Workspaces multi-tenant, rôles Owner/Admin/Manager/VA, invitations, affectations et permissions.
- RLS Supabase pour isoler les données des Workspaces.
- Social Control Center sur `/comptes` : Instagram, Facebook, Messenger, TikTok, YouTube, Threads et X/Twitter.
- Comptes sociaux : ajout de fiche, recherche, filtre, détails, statut, activation/désactivation et suppression.
- Les OAuth sociaux ne sont pas simulés. Sans credentials officiels, l’interface affiche `Configuration API requise`.
- Link Pages privées sur `/link-pages` et pages publiques sur `/p/:slug`, avec liens, aperçu, réorganisation et analytics réelles.
- Médiathèque, brouillons, calendrier, analytics, notifications, assistants IA et gestion d’équipe V2.
- Page d’abonnement `/abonnement` avec plan actuel, période d’essai, offres, limites, utilisation et boutons `Paiement à configurer`.
- Aucun paiement réel n’est activé dans cette version.

## Prérequis

- Node.js compatible avec le projet (Node 22 conseillé) et pnpm.
- Projet Supabase avec Auth e-mail et les migrations présentes dans `supabase/migrations/`.
- Les clés de votre propre projet Supabase. Elles ne sont volontairement pas incluses dans l’archive.

## Installation locale

1. Décompressez l’archive et ouvrez un terminal dans le dossier `trafficflow`.
2. Installez les dépendances : `pnpm install --frozen-lockfile`.
3. Créez localement un fichier `.env` non versionné et renseignez au minimum les variables suivantes avec les valeurs de votre projet Supabase :

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
   ```

4. Vérifiez les migrations déjà présentes dans le projet Supabase cible. Ce README historique ne doit pas servir à rejouer les migrations d’un projet TrafficFlow déjà migré.
5. Vérifiez et démarrez : `pnpm check`, `pnpm test`, `pnpm build`, puis `pnpm dev`.
6. Ouvrez l’URL locale affichée par le serveur, habituellement `http://localhost:3000`.

## Configuration et sécurité

- Ne partagez pas votre `.env` et ne commitez pas les clés. Utilisez les variables configurées par votre hébergeur en production.
- Les clés Supabase et les données déjà hébergées dans votre projet Supabase ne sont pas exportées dans cette archive.
- Les APIs sociales nécessitent des applications développeur, des secrets, des URI de rappel publiques et l’approbation des scopes. La frontière d’intégration est préparée dans `server/integrations/social-oauth.ts`, mais aucun OAuth de production n’est activé sans credentials officiels.
- SASPay n’est pas intégré. Les boutons d’abonnement restent explicitement en état `Paiement à configurer`.
- Pour déployer l’archive FINAL sur Vercel, suivez `GUIDE-DEPLOIEMENT-FINAL-FR.md`; configurez les variables et vérifiez les URL de redirection Supabase Auth. Ne réappliquez pas la migration 0012 déjà exécutée.

## Déploiement Vercel

Le fichier `vercel.json` configure :

- installation avec `pnpm install --frozen-lockfile` ;
- build avec `pnpm build` ;
- sortie frontend `dist/public` ;
- routage `/api/*` vers l’API serveur ;
- fallback des routes applicatives vers `index.html`.

## Vérifications

Les commandes de référence sont :

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Les routes de vérification sont :

- `/api/health`
- `/manus-routes.json`
