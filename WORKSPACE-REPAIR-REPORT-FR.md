# TrafficFlow V2 — Correctif Workspace

## Portée

Ce paquet repart de `trafficflow-v2-tranches-1-3-vercel.zip`. Il conserve les fichiers existants et ajoute une correction ciblée au parcours d’accès Workspace. Le ZIP source d’origine n’est pas remplacé.

## Modifications

- `supabase/migrations/0002_workspace_operations.sql` : les révocations de deux fonctions facultatives sont conditionnées à leur présence, ce qui rend la migration compatible avec une base Supabase neuve. Le RPC `trafficflow_get_my_workspaces()` est créé en `SECURITY INVOKER`, de sorte que les policies RLS existantes restent applicables dès l’installation initiale.
- `supabase/migrations/0011_workspace_rpc_repair.sql` : migration corrective idempotente et transactionnelle. Elle échoue explicitement si les tables V2, le RPC de création ou le trigger d’inscription sont absents. Le RPC de liste n’accepte aucun Workspace fourni par le client : il limite le résultat à `auth.uid()` et aux appartenances actives. L’exécution est accordée à `authenticated`, pas à `anon`/`PUBLIC`. Le script demande enfin le rechargement du cache PostgREST.
- `server/workspace-rpc-migration.test.ts` : test de contrat qui vérifie la signature, le filtre, `SECURITY INVOKER`, les droits, les garde-fous d’inscription et l’ordre transactionnel.
- `WORKSPACE-REPAIR-REPORT-FR.md` : ce rapport et les étapes de déploiement.

Aucun fichier V2 existant n’a été supprimé. Le parcours UI `workspace.list` / `workspace.create` est conservé. `0001` installe le trigger qui crée un Workspace lors d’une nouvelle inscription; pour un compte déjà existant sans membership, l’interface propose la création explicite via `trafficflow_create_workspace()` (aucune création fictive ou automatique n’est ajoutée).

## Application dans Supabase

Ne lancez pas un script combiné et ne réappliquez pas des migrations déjà enregistrées. Dans le SQL Editor du projet Supabase TrafficFlow, appliquer **une migration à la fois, dans cet ordre**, en copiant intégralement le contenu du fichier correspondant :

1. `supabase/migrations/0001_trafficflow_v2.sql`
2. `supabase/migrations/0002_workspace_operations.sql` (version corrigée incluse dans ce paquet)
3. `supabase/migrations/0003_profiles_assignments.sql`
4. `supabase/migrations/0004_rls_column_hardening.sql`
5. `supabase/migrations/0005_legacy_import.sql`
6. `supabase/migrations/0006_subscription_social_integrations.sql`
7. `supabase/migrations/0007_usage_activity.sql`
8. `supabase/migrations/0008_activity_and_role.sql`
9. `supabase/migrations/0009_social_account_plan_guard.sql`
10. `supabase/migrations/0010_link_pages.sql`
11. `supabase/migrations/0011_workspace_rpc_repair.sql`

Si les migrations `0001`–`0010` sont déjà installées, appliquer seulement `0011` après avoir vérifié que leurs objets sont présents. La migration `0011` vérifie aussi le trigger actif `on_auth_user_created_trafficflow` et s’annule avec une erreur claire s’il est absent/désactivé.

## Vérifications après application

Dans Supabase, vérifier dans Database → Functions (ou via le SQL Editor) que `public.trafficflow_get_my_workspaces()` n’a aucun argument et retourne les colonnes attendues : `workspace_id`, `workspace_name`, `role`, `member_status`, `subscription_status`, `plan_code`, `trial_ends_at`. Vérifier que `authenticated` a `EXECUTE`, et que `anon`/`PUBLIC` ne l’ont pas. Vérifier que `prosecdef` est `false` (fonction invoker) et que le trigger `auth.users.on_auth_user_created_trafficflow` est actif.

Tester ensuite avec un utilisateur authentifié :

1. `trafficflow_get_my_workspaces()` doit ne renvoyer que ses Workspaces actifs.
2. Un utilisateur sans Workspace doit obtenir une liste vide, puis pouvoir créer un Workspace par le formulaire prévu; la ligne membership doit porter son propre `auth.uid()` avec le rôle `owner`.
3. Une nouvelle inscription doit créer un profil, un Workspace, une membership owner active et un essai Starter; elle ne doit créer aucun doublon pour un même événement d’inscription.
4. Confirmer qu’un autre utilisateur ne voit pas le Workspace (RLS/identité) et que l’appel anonyme au RPC est refusé.
5. Si PostgREST ne détecte pas la fonction immédiatement, patienter quelques secondes puis réessayer; `0011` envoie déjà `NOTIFY pgrst, 'reload schema'`.

## Statut

Les vérifications locales du code et du build sont consignées dans la remise. Ce ZIP ne signifie pas que Supabase a été réparé : cela n’est vrai qu’après application effective des migrations et vérification des fonctions/permissions/trigger dans le projet ciblé.
