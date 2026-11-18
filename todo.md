# TrafficFlow FINAL — état des fonctionnalités et dépendances

Ce document remplace la checklist d’une ancienne variante V2. Pour les détails d’installation, variables, quotas et étapes Vercel, voir `GUIDE-DEPLOIEMENT-FINAL-FR.md`.

## Fonctions livrées dans le code de cette archive

- Authentification Supabase e-mail, récupération/changement de mot de passe, routes `/connexion` et `/inscription`; Google disponible lorsque le provider Google est configuré dans Supabase.
- Workspaces multi-tenant, membership et rôles, RLS, invitations à lien, permissions, affectations, tâches d’équipe.
- Dashboard, gestion des comptes sociaux (fiches, recherche, filtre, détails, activation/désactivation, suppression) pour Instagram, Facebook, TikTok, YouTube, Threads, X et LinkedIn. Les anciens comptes Messenger restent accessibles en historique, sans stats ni connexions actives.
- Modes d’interface Simple, Créateur et Professionnel, avec onboarding et préférence conservée localement; aucun changement de rôles/RLS/quotas.
- Business (membres, tâches, invitations et demandes d’approbation) disponible en mode Professionnel; Intelligence (comparaisons réelles de volume de contenu et export CSV) en modes Créateur et Professionnel.
- Link Pages avec pages publiques `/p/:slug`, liens et mesures de vues/clics prévues par le schéma.
- Médiathèque privée, dossiers/tags, associations médias-comptes; brouillons et programmation dans le calendrier.
- Assistants IA configurables par compte et tâches de génération côté serveur avec Gemini prioritaire/Groq fallback; requiert au moins une clé valide côté serveur.
- Analytics fondées sur les données sauvegardées; limites d’utilisation, événements d’abonnement et historique.
- Forfaits Free, Standard, Pro et Business; quotas V3 contrôlés par Supabase et affichés depuis `trafficflow_get_usage_v3`.
- Handler serverless Vercel compilé séparément; `/api/health` retourne du JSON; routes API protégées renvoient du JSON même en cas d’erreur.

## Forfaits dans le code et la migration 0012

| Offre | Prix | Comptes | Link Pages | Membres | VA | Posts programmés | Messages IA/mois | Automatisations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Free | 0 $ | 3 | 1 | 1 | 0 | 20 | 20 | 0 |
| Standard | 9 $/mois | 10 | 5 | 3 | 2 | 100 | 250 | 5 |
| Pro | 29 $/mois | 50 | 20 | 10 | 9 | 500 | 750 | 25 |
| Business | 99 $/mois | 150 | Illimitées | 30 | 29 | 2 000 | 2 000 | 100 |

## Incomplet — ne pas commercialiser comme déjà connecté

- OAuth officiel et worker de publication : routes OAuth signées, tokens chiffrés AES-256-GCM, connecteurs des 7 plateformes, réservation atomique et transitions `scheduled → processing → published/failed` livrés. La validation réelle dépend encore des credentials, scopes et App Reviews des fournisseurs.
- Les plateformes sont Instagram, Facebook, TikTok, YouTube, Threads, X et LinkedIn. Les anciennes fiches Messenger ne sont pas supprimées; les limites de média et de format sont documentées dans le guide de déploiement.
- SASPay/Binance Pay : aucun paiement réel opérationnel. Le code bloque le checkout tant que SASPay n’est pas intégré et ne change jamais le plan sans confirmation validée côté serveur.
- Analytics et inbox sociales en temps réel : pas de synchronisation via APIs officielles.
- Workflow d’approbation Business : code client/API et migration additive 0014 ajoutés. Il exige une approbation d’un autre Owner/Admin/Manager avant programmation (snapshot vérifié; notification interne). **La migration 0014 n’a pas été appliquée** : cette fonction n’est pas opérationnelle sur la base tant qu’elle n’est pas examinée puis appliquée manuellement.
- Business : entités marque/projet distinctes du Workspace et journal d’audit complet non modélisés; le rapport CSV actuel reste un instantané.
- Intelligence : contenus les plus performants, évolution des interactions et recommandations sociales ne sont pas calculables sans données officielles.
- Automatisations : règles configurables; le worker de publication est déclenché par `/api/cron/publish` chaque minute via Vercel Cron. Les déclencheurs `post_published` et `post_failed` exécutent maintenant les workflows actifs, inscrivent `automation_runs` et génèrent les notifications/suggestions prévues. `refresh_analytics` reste mis en file jusqu’à l’implémentation des collecteurs officiels.
- E-mails automatiques d’invitation : non configurés; l’envoi du lien est manuel.

## État Supabase et Vercel

Le propriétaire a confirmé que la migration SQL 0012 a déjà été exécutée. Ne pas la relancer. Les migrations additives 0013, 0014 et 0015 sont dans le paquet mais **non exécutées**. Les appliquer dans cet ordre après revue; 0015 est obligatoire avant d’activer le cron de publication.

Aucun déploiement Vercel n’a été lancé durant la mise à jour. Le ZIP et la copie de staging ne remplacent pas automatiquement le code de preview Manus ou le dépôt Vercel.

## Dernière validation locale

Validation du 16 novembre 2026 : `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build` et 38 tests locaux déterministes réussis. Le smoke test local de `dist/index.js` répond correctement à `/api/health`. Les corrections OAuth et le dispatch d’automatisations post-publication sont inclus dans cette copie; aucune validation réelle fournisseur n’a été exécutée.
