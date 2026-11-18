# TrafficFlow V2 — réseaux sociaux et préparation au déploiement

Date : 24 octobre 2026

> **Archive historique.** Cette liste reflète le périmètre du 24 octobre 2026 et est remplacée par la décision du 1er novembre : Messenger est retiré des plateformes TrafficFlow. Les fiches sociales Messenger historiques sont conservées; la messagerie interne de TrafficFlow n’est pas concernée. Voir `GUIDE-DEPLOIEMENT-FINAL-FR.md` pour le périmètre courant.

## Modifications livrées

La landing page comporte maintenant une section responsive dédiée aux sept réseaux demandés, avec des icônes SVG de marque et un court descriptif par carte. Instagram, Facebook, TikTok, YouTube et Threads sont indiqués « OAuth à configurer » : ils sont présentés comme cibles de connecteurs, et non comme intégrations opérationnelles. Messenger et X affichent exactement « Bientôt disponible ». LinkedIn a été retiré des surfaces de l’interface concernées.

Les mêmes états sont repris dans les paramètres et la liste des plateformes du cockpit. Un avertissement précise qu’un logo ne signifie pas qu’un compte est connecté ni qu’une publication est active. Les SVG viennent de Simple Icons pour les six marques disponibles dans cette bibliothèque et de l’icône de marque Font Awesome pour Messenger; aucune image distante n’est chargée.

Les alias français `/connexion` et `/inscription` sont présents, et les liens marketing les utilisent. Le bouton « Continuer avec Google » est visible sur les modes connexion et inscription; il reste désactivé si Supabase n’est pas configuré. Les routes historiques `/login` et `/signup` sont conservées.

Les correctifs Workspace sont présents dans l’archive : `0002_workspace_operations.sql`, `0011_workspace_rpc_repair.sql`, le test de contrat `server/workspace-rpc-migration.test.ts` et le script de vérification `supabase/verify_workspace_rpc.sql`. Aucun changement de schéma ou appel d’écriture Supabase n’a été effectué pendant ce travail; la présence de ces fichiers ne signifie pas que la base réelle a été corrigée.

Les marques et leurs logos restent la propriété de leurs détenteurs. Meta indique que son icône Messenger a été mise à jour en février 2025 et publie ses règles d’utilisation et ressources de marque; vérifier et respecter ces règles avant une diffusion commerciale [1].

## Vérifications exécutées

Dans cette copie complète du projet :

- `pnpm install --frozen-lockfile` : réussi, lockfile à jour.
- `pnpm check` : réussi.
- `pnpm test` : réussi, 4 fichiers de tests et 11 tests.
- `pnpm build` : réussi. Le frontend est généré sous `dist/public`; le bundle serveur reste séparé sous `dist` et le bundle Vercel API est conservé dans la configuration du projet.

Vite signale que le bundle JavaScript principal dépasse 500 kB minifié. C’est un avertissement de taille, pas un échec de build.

## Déploiement Vercel

La configuration incluse dans `vercel.json` utilise `pnpm install --frozen-lockfile`, `pnpm build` et `dist/public` comme répertoire de sortie. Elle réécrit `/api/*` vers la fonction API et les autres chemins vers `index.html` pour le routage SPA. Commandes de contrôle local :

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Le déploiement Vercel n’a pas été lancé dans cette livraison. Après import du ZIP dans un projet Vercel, vérifier que le Root Directory est la racine du projet, puis tester la landing, `/connexion`, `/inscription` et les routes API sur l’URL fournie par Vercel.

## Migration Workspace Supabase — à appliquer par le propriétaire

Aucune migration n’a été exécutée sur Supabase pendant cette tâche. La correction Workspace n’est donc pas déclarée appliquée ni vérifiée sur la base réelle.

Dans le tableau de bord du projet Supabase TrafficFlow, ouvrir **SQL Editor** et appliquer les migrations du dossier `supabase/migrations` dans l’ordre numérique, de `0001_trafficflow_v2.sql` à `0011_workspace_rpc_repair.sql`. Pour une base déjà partiellement migrée, comparer d’abord les migrations déjà appliquées et ne lancer que celles qui manquent, toujours dans l’ordre. La migration `0011` échoue volontairement si les prérequis V2 ou le trigger de provisioning d’inscription sont absents : ne pas la contourner en créant un faux RPC.

Après les migrations, exécuter `supabase/verify_workspace_rpc.sql` dans le SQL Editor. Vérifier que le RPC `public.trafficflow_get_my_workspaces()` existe, que `authenticated` peut l’exécuter, que `anon` ne le peut pas, et que le trigger `on_auth_user_created_trafficflow` est actif. La migration 0011 émet déjà `NOTIFY pgrst, 'reload schema'` pour rafraîchir le cache PostgREST. Enfin, effectuer les parcours réels avec un utilisateur authentifié : récupérer les Workspaces autorisés, créer un Workspace à l’inscription et récupérer ce Workspace après connexion. Les données restent filtrées par l’utilisateur authentifié via `auth.uid()` et les règles RLS; la fonction est `SECURITY INVOKER`.

## Références

[1]: https://www.meta.com/brand/resources/facebook/messenger-icon/ "Messenger icon — Meta Brand Resource Center"
