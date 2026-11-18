# TrafficFlow FINAL — guide de configuration et de déploiement

**État de cette archive au 15 novembre 2026.** Cette copie part du SaaS existant, sans remplacer le ZIP d’origine, le projet Manus existant ni un dépôt Vercel. Aucune migration n’a été exécutée sur Supabase et aucun déploiement Vercel n’a été lancé pendant cette mise à jour.

## 1. Fonctionnalités présentes dans le code

- **Modes et onboarding :** Simple, Créateur et Professionnel organisent la navigation, sans modifier les rôles, RLS ou quotas. Le choix d’expérience est conservé localement.
- **Workspaces et équipe :** isolation multi-tenant, RLS, rôles Owner/Admin/Manager/VA, invitations par lien, tâches et affectations conformément au schéma existant.
- **Business :** synthèse de données Workspace, file de demandes d’approbation, décisions Owner/Admin/Manager, historique, notifications internes et export CSV. Le forfait effectif Business exige une décision d’une autre personne responsable avant qu’un post puisse devenir programmé. La garde est dans la migration 0014 et n’est **pas active sur une base** avant son application.
- **Intelligence :** comparaison des comptes et valeurs de référence, comparaison du volume de contenus créés sur deux fenêtres de 30 jours, export CSV. Ces métriques sont internes; elles ne mesurent pas l’engagement social ni les performances par plateforme.
- **IA :** Gemini est essayé en premier, Groq en secours; génération côté serveur pour idées, légendes, variantes de plateforme, métadonnées, calendrier éditorial et revue de contenu. Le quota IA demeure consommé via le RPC existant. Une clé valide est nécessaire et aucune requête réelle à Gemini/Groq n’a été effectuée pendant les tests.
- **Modules conservés :** Link Pages, comptes, contenus, calendrier, abonnements/limites 0012, paramètres et messagerie interne. La messagerie interne n’est pas touchée par le retrait de Messenger social.
- **Réseaux connectables :** Instagram, Facebook, TikTok, Threads, X, LinkedIn et YouTube. Les routes OAuth, l’état signé, le chiffrement AES-256-GCM des tokens et les connecteurs de publication sont inclus; chaque fournisseur exige encore ses identifiants, scopes, URL de callback et éventuelle App Review. Les anciennes fiches sociales Messenger ne sont pas effacées.
- **Automatisations post-publication :** les workflows actifs `post_published` et `post_failed` sont déclenchés par le worker. Les exécutions sont enregistrées dans `automation_runs`; les notifications VA/manager et les suggestions sont générées. Le rafraîchissement Analytics est seulement mis en file jusqu’à l’implémentation des collecteurs fournisseurs.
- **Vercel :** frontend produit dans `dist/public`, handler API compilé à part dans `dist-server/api-handler.js`, Node 22, routes `/api/*`, endpoint `/api/health` et fallback SPA.

## 2. Forfaits 0012 — valeurs conservées

| Offre | Prix/mois | Comptes sociaux | Link Pages | Membres | VA | Posts programmés | Messages IA/mois | Automatisations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Free | 0 $ | 3 | 1 | 1 | 0 | 20 | 20 | 0 |
| Standard | 9 $ | 10 | 5 | 3 | 2 | 100 | 250 | 5 |
| Pro | 29 $ | 50 | 20 | 10 | 9 | 500 | 750 | 25 |
| Business | 99 $ | 150 | illimitées | 30 | 29 | 2 000 | 2 000 | 100 |

La migration 0012 est déclarée déjà exécutée par le propriétaire : **ne pas la relancer**. La base et ses RPC/triggers restent l’autorité finale pour les quotas.

## 3. Migrations additionnelles (non exécutées)

L’archive contient désormais :

- `supabase/migrations/0013_retire_messenger.sql` — retrait non destructif de la plateforme sociale Messenger; conserve les lignes historiques et bloque les nouveaux usages concernés une fois appliquée.
- `supabase/migrations/0014_business_post_approvals.sql` — table/RLS de demandes d’approbation, RPC de soumission et décision, notifications internes, capture de version, contrôle de permission et trigger interdisant la programmation directe Business sans approbation.
- `supabase/migrations/0015_social_oauth_publication_worker.sql` — colonnes de tokens chiffrés et statuts fournisseur, index de publications dues et RPC atomique `trafficflow_claim_due_posts` utilisée par le worker.

**Ni 0013, ni 0014, ni 0015 n’ont été appliquées ou vérifiées sur Supabase.** Appliquer dans l’ordre `0013`, `0014`, puis `0015`, sans rejouer `0012`, après revue et sauvegarde. La 0015 doit être appliquée avant d’activer le cron de publication. Elle est additive et ne supprime ni comptes ni posts.

## 4. Variables d’environnement

Le fichier `.env.example` livré liste les noms sans secrets. Dans Vercel, définir les valeurs uniquement dans les paramètres d’environnement appropriés; ne jamais committer de clé réelle.

### Requises pour Supabase Auth/API

- `VITE_SUPABASE_URL` — URL du projet choisi.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — clé publique/publishable (ou ancienne clé `anon` publique); jamais la service-role.

### IA, si l’assistant est utilisé

- `GEMINI_API_KEY` — fournisseur principal.
- `GROQ_API_KEY` — solution de secours. Au moins un fournisseur doit être configuré; aucun secret n’est envoyé au navigateur.

### OAuth social et worker (variables seules insuffisantes)

`.env.example` contient les noms Meta/Instagram/Facebook, TikTok, YouTube/Google, Threads, X et LinkedIn. Ajouter aussi `SOCIAL_OAUTH_STATE_SECRET` (secret aléatoire long), `SOCIAL_TOKEN_ENCRYPTION_KEY` (clé AES-256 en base64) et `CRON_SECRET`. Configurer dans chaque console les callbacks `https://<domaine>/api/social/oauth/<plateforme>/callback` et autoriser l’origine publique `APP_URL`. Les scopes Analytics ajoutés dans le code exigent une réautorisation des connexions existantes. Les fournisseurs ne sont pas validés en production dans ce paquet : leurs permissions, App Review, quotas et comptes professionnels doivent être confirmés séparément.

### Paiement, cron et facultatives

- `SASPAY_API_KEY`, `SASPAY_API_SECRET`, `SASPAY_WEBHOOK_SECRET`, `SASPAY_BASE_URL` — variables préparées mais insuffisantes seules; l’adaptateur SASPay demeure explicitement `false` tant que le contrat officiel de création et de signature webhook n’est pas fourni et validé. Le checkout est refusé même si ces champs sont renseignés.
- `SUPABASE_SERVICE_ROLE_KEY` — serveur seulement si une fonction administrative le requiert; ne jamais préfixer `VITE_`.
- `CRON_SECRET` — serveur seulement; protège `/api/cron/subscriptions` et `/api/cron/publish`.
- `APP_URL` — origine publique prévue par les redirections serveur, notamment pour le futur adaptateur de paiement.
- `VITE_ANALYTICS_ENDPOINT` et `VITE_ANALYTICS_WEBSITE_ID` — facultatives.

## 5. Limites connues et production

- OAuth et publication : le code est préparé, mais un déploiement réel nécessite les credentials et validations officielles. Le cron Vercel appelle `/api/cron/publish` chaque minute; le worker réserve atomiquement les posts `scheduled`, puis écrit `processing`, `published` ou `failed` avec l’ID fournisseur et l’erreur.
- Instagram, TikTok et YouTube nécessitent un média. YouTube publie une vidéo; Facebook, Threads, LinkedIn et X acceptent le texte. X avec média est refusé volontairement tant que l’upload média v2 n’est pas intégré. Les médias LinkedIn doivent être validés séparément selon le type d’asset.
- SASPay/Binance Pay : aucun paiement réel n’est possible/confirmé. Pas de signature de webhook fournisseur validée, de checkout live ni d’activation d’abonnement par simple retour navigateur.
- E-mails automatiques d’invitation : non configurés; le partage des invitations reste manuel.
- Données d’analytics en temps réel et contenus « les plus performants » : non disponibles faute de connecteurs officiels. Les exports CSV sont des instantanés des lignes réellement accessibles, pas des rapports d’événements sociaux.
- Les Workspaces fournissent l’espace de collaboration, mais cette archive ne modélise pas encore des entités marque/projet séparées. Elle ne fournit pas non plus un journal d’audit exhaustif ni un moteur de recommandations de performance.

## 6. Paramètres Vercel et vérification après un futur déploiement

À la racine contenant `package.json` et `vercel.json`, la configuration prévoit l’installation figée, `pnpm build`, `dist/public`, le handler `api/index.ts`, Node 22 et les crons d’abonnement/publication. Définir les variables avant le build, appliquer les migrations, puis vérifier `/`, `/connexion`, `/inscription`, `/dashboard`, `/comptes`, `/calendrier` et `/api/health`. Tester chaque callback OAuth et un post de test privé avant d’ouvrir la publication publique.

## 7. Commandes de validation

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Validation de cette archive : `pnpm install --frozen-lockfile`, `pnpm check`, build Vite/esbuild et 38 tests déterministes réussissent. Un build/smoke test local ne prouve ni une migration active, ni OAuth, paiement, publication sociale ou déploiement réussi.
