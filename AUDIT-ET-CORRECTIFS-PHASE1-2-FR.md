# TrafficFlow V2 — Audit (phase 1) et correctifs Vercel (phase 2)

Date : 24 octobre 2026

> **Document historique.** Les références aux plateformes et intégrations reflètent l’état du 24 octobre 2026, pas la politique actuelle. Messenger est retiré du périmètre social; ses données historiques sont conservées et la messagerie interne n’est pas modifiée. Consulter `GUIDE-DEPLOIEMENT-FINAL-FR.md` pour la liste active.

## Statut de vérification — à lire en premier

Le registre npm était bloqué (403 de la politique réseau) dans l'environnement où ce travail a été fait. **Aucune dépendance n'a pu être installée : `tsc`, `vite build`, le build API et `vitest` n'ont PAS été exécutés sur ces modifications.** Seule la logique de réécriture d'URL de la fonction API a été vérifiée (script Node seul). Les corrections ci-dessous sont donc **non prouvées** tant que vous n'avez pas lancé :

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:vercel
node -e "import('./api/index.js').then(m=>console.log(typeof m.default))"   # doit afficher "function"
```

## Causes identifiées par lecture du code

| # | Erreur Vercel | Cause constatée | Correctif |
|---|---|---|---|
| 1 | `ERR_MODULE_NOT_FOUND server/_core/index` | `api/index.ts` importait `../server/_core/index` sans extension ; Vercel exécute en ESM (`"type":"module"`), l'import n'est pas résolu. | La fonction est désormais **bundlée par esbuild** en `api/index.js` (`pnpm build:api`), les imports relatifs sont résolus à la compilation. |
| 2 | `lightningcss.linux-x64-gnu.node` introuvable | `server/_core/index.ts` importait `./vite` → `vite.config` → `@tailwindcss/vite` → `lightningcss` (binaire natif) dans la fonction. Le lockfile contient bien `lightningcss-linux-x64-gnu`. | Nouveau `server/_core/app.ts` **sans aucun import Vite**. Vite n'est chargé (import dynamique) que par le serveur local `server/_core/index.ts`. |
| 3 | Types `Request.query` / `Request.url` | `api/index.ts` typait le handler avec `Request` d'Express alors que Vercel fournit `IncomingMessage`. | Handler typé `IncomingMessage` / `ServerResponse` (`server/vercel/handler.ts`). |
| 4 | HTTP 500 sur `workspace.list` | Au moins deux causes possibles. (a) Crash de la fonction (1 et 2). (b) **Bug réel** : l'ancien handler reconstruisait `req.url = /api/<path>` en **perdant la query string** ; tRPC envoie `?batch=1&input=…`, donc l'entrée était perdue. | Query string conservée (vérifié en Node). La cause (a) à confirmer dans les logs Vercel après redéploiement ; le RPC Supabase `trafficflow_get_my_workspaces` dépend aussi de l'application des migrations (voir plus bas). |
| 5 | `Unexpected token 'A', "A server error"` | Le texte brut « A server error » de Vercel était parsé comme JSON. | `client/src/main.tsx` : toute réponse non JSON est convertie en erreur lisible. Côté serveur, `/api/*` répond toujours en JSON (404 et 500 compris). |
| 6 | `VITE_ANALYTICS_*` absentes | `client/index.html` chargeait `%VITE_ANALYTICS_ENDPOINT%/umami` inconditionnellement. | Script retiré du HTML ; injecté dans `main.tsx` seulement si les deux variables existent (https). Variables ajoutées à `.env.example` comme facultatives. |

Autres changements : `vercel.json` (`buildCommand: pnpm build:vercel`, `maxDuration` 30 s, la règle SPA n'avale plus `/api/*`), `.gitignore` (`api/index.js`), limite du corps JSON ramenée de 50 Mo à 10 Mo, `crypto` importé explicitement.

## Points à vérifier au déploiement (non confirmables ici)

- Vercel doit détecter `api/index.js` généré pendant le build. Si la fonction n'apparaît pas dans l'onglet *Functions*, le contrôle est à faire sur le Root Directory et sur le log de build.
- Avec `--packages=external`, les dépendances serveur doivent rester dans `dependencies` (c'est le cas).
- Migrations Supabase `0001`→`0011` non appliquées par moi ; voir `WORKSPACE-REPAIR-REPORT-FR.md`.

## Écarts entre le prompt maître et l'existant (non traités, décisions requises)

1. **Forfaits** : la base et le code utilisent `starter / pro / business / enterprise` (`requestPlanChange`, migrations 0006/0009) ; le prompt demande **Free / Standard 9 $ / Pro 29 $ / Business 99 $** avec des limites différentes. Il faut migrer la table de plans et les gardes SQL.
2. **Rôles** : existant `owner / admin / manager / va` ; prompt : propriétaire / manager / membre / assistant.
3. **Réseaux** : le code inclut YouTube dans `accounts.add` ; le prompt le liste hors périmètre prioritaire (Instagram, Facebook, Messenger, TikTok, Threads ; X « bientôt »).
4. **Paiements SASPay** : `server/integrations/saspay.ts` ne contient que la vérification de configuration. Il n'existe aucun appel API ni webhook ; il faut la **documentation officielle SASPay** (endpoints, signature des webhooks, sandbox). Rien ne sera inventé.
5. **OAuth sociaux** : `social-oauth.ts` ne contient qu'un catalogue ; aucun flux OAuth n'est implémenté. Chaque réseau exige une application Meta / TikTok validée.
6. **Héritage Manus** : `oauth.ts`, `sdk.ts`, `storageProxy`, `allowedHosts` `*.manus*`, `vite-plugin-manus-runtime` et la base MySQL V1 sont conservés mais sans lien avec Supabase ; à retirer ou isoler.
7. Fonctionnalités du prompt sans code constaté : éditeur de publications complet, calendrier, publication planifiée (worker/cron), analytics réelles, Link Pages avancées (A/B, pixels, géo), facturation, export CSV.

## Prochaines phases proposées

Phase 3 (auth/workspaces/permissions) et 4 (plans + limites) sont les plus utiles ensuite ; la phase 5 est bloquée par la documentation SASPay.


---

# Mise à jour — phases 4 et 5 (forfaits, limites, facturation)

**Même réserve de vérification** : aucune de ces modifications n'a été compilée ni testée (npm bloqué). `server/plans.test.ts` a été écrit mais **pas exécuté**. Le SQL n'a pas été exécuté sur une base Postgres.

## Ajouté

- `supabase/migrations/0012_plans_v3_billing.sql` (+ `supabase/migrations_down/0012_down.sql`) :
  - forfaits **Free 0 $ / Standard 9 $ / Pro 29 $ / Business 99 $** avec comptes, membres, Link Pages (NULL = illimité), publications programmées, IA et automatisations ; `starter` et `enterprise` conservés mais masqués ;
  - essai **7 jours** à l'inscription (limites Free) ;
  - `private.effective_plan()` : un paiement échoué hors grâce, une annulation ou une expiration ramènent aux limites Free **sans supprimer aucune donnée** ;
  - limites appliquées par **triggers SQL** : comptes sociaux, Link Pages, publications programmées ; membres (invitations) et IA dans leurs RPC ;
  - Threads ajouté aux réseaux autorisés (il était refusé par la contrainte SQL d'origine) ;
  - tables `payment_transactions`, `payment_webhook_events` (unicité provider+event → webhooks dupliqués ignorés), `invoices`, RLS lecture propriétaire/admin, aucune écriture client ;
  - `trafficflow_create_payment` (montant lu en base), `trafficflow_apply_payment_result` (**service_role uniquement**, vérifie le montant, active le forfait, crée la facture), `trafficflow_cancel_subscription`, `trafficflow_expire_subscriptions` (grâce 7 jours), `trafficflow_get_usage_v3`.
- `shared/plans.ts` : définition unique des forfaits côté interface ; landing et page Abonnement l'utilisent. « Choisir ce forfait » → `/inscription?plan=…` (mémorisé) puis `billing.checkout`.
- `server/routers/billing.ts`, `server/_core/supabaseAdmin.ts`, endpoints `/api/webhooks/saspay` et `/api/cron/subscriptions` (Bearer `CRON_SECRET`, planifié dans `vercel.json`).

## Ce qui reste bloqué ou non fait

- **SASPay** : `SASPAY_ADAPTER_IMPLEMENTED = false`. Le checkout renvoie « paiement pas encore activé » et le webhook répond 401 à tout. Il me faut la doc officielle (création de paiement, signature des webhooks, sandbox). **Aucune activation d'abonnement n'est possible tant que ce n'est pas implémenté** — c'est voulu.
- **Binance Pay** : non intégré.
- **Rôles** : les rôles existants (`owner/admin/manager/va`) sont conservés ; ils couvrent propriétaire / manager / membre / assistant avec permissions par compte, mais le vocabulaire diffère de votre prompt.
- **Non traités** : OAuth des réseaux et publication réelle, calendrier jour/semaine/mois, éditeur complet, analytics réelles, Link Pages avancées (A/B, pixels, géo, glisser-déposer), export CSV, suppression sécurisée du compte, multi-langues, mode sombre. Chacun est un chantier à part entière et doit être vérifié par build/tests.
- Les migrations `0001`→`0012` ne sont pas appliquées à votre Supabase.

## Variables d'environnement (Vercel)

| Nom | Public ? | Usage |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | public | client + vérification JWT serveur |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | webhooks et cron uniquement |
| `APP_URL` | public | retours de paiement |
| `CRON_SECRET` | **secret** | protège `/api/cron/subscriptions` |
| `SASPAY_API_KEY`, `SASPAY_API_SECRET`, `SASPAY_WEBHOOK_SECRET`, `SASPAY_BASE_URL` | **secrets** | paiement |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | **secrets** | IA |
| `META_APP_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | **secrets** | OAuth |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | public, facultatif | analytics |

Aucune clé secrète ne doit porter le préfixe `VITE_`.

## Déploiement (résumé)

1. Appliquer les migrations `0001`→`0012` dans le SQL Editor Supabase, une par une (voir `WORKSPACE-REPAIR-REPORT-FR.md`), puis `verify_workspace_rpc.sql`.
2. Supabase → Authentication → URL Configuration : *Site URL* = domaine Vercel ; ajouter `https://<domaine>/auth/callback` et `/reset-password` aux Redirect URLs.
3. Pousser sur GitHub, importer dans Vercel (racine du dépôt), renseigner les variables ci-dessus.
4. Vérifier : landing, inscription, connexion, `/api/health` (JSON), Workspace, page Abonnement, puis (après implémentation SASPay) un paiement en sandbox.
