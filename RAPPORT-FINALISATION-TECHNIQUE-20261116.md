# TrafficFlow — compte rendu technique de finalisation

**Date : 16 novembre 2026**

Ce document décrit l’état réel de la copie finalisée de TrafficFlow. L’archive originale et les fichiers du SaaS de départ ont été conservés. Les changements ont été effectués uniquement dans la copie de travail `trafficflow-finalized-20261115`.

## Ce qui a été activé dans cette passe

Le worker de publication déclenche désormais les workflows actifs après chaque résultat de publication. Un workflow `post_published` est exécuté après un succès et un workflow `post_failed` après un échec. Les conditions simples présentes dans le JSON du workflow sont évaluées sur le contexte de l’événement. Chaque exécution est inscrite dans `automation_runs` avec son statut, son payload, son résultat et son erreur éventuelle.

Les actions `notify_va` et `notify_manager` créent maintenant les notifications destinées aux membres actifs correspondant au rôle. `suggest_reply` crée une suggestion dans les notifications. `manual` journalise l’événement. `refresh_analytics` est marqué `queued_for_connector` : le déclenchement est actif, mais le collecteur Analytics fournisseur par fournisseur n’existe pas encore. Une automatisation ne peut donc pas prétendre avoir rafraîchi les statistiques tant que le connecteur concerné n’est pas développé.

Les corrections OAuth de cette passe ajoutent les scopes Analytics identifiés pour Instagram, Facebook, Threads, TikTok et YouTube. Les scopes X sont maintenant sérialisés avec des espaces, comme le demande OAuth 2.0, et l’échange LinkedIn comporte explicitement `grant_type=authorization_code`. Les publishers Instagram et Facebook utilisent la version Meta configurée par `SOCIAL_API_VERSION` au lieu de versions codées en dur. Ces changements exigent une nouvelle autorisation des comptes et les validations des plateformes ; ils ne remplacent pas les App Reviews.

## Limites d’abonnement vérifiées

Les limites affichées dans `shared/plans.ts` sont cohérentes avec la migration Supabase `0012_plans_v3_billing.sql`. Le forfait Free coûte 0 USD et comprend 3 comptes sociaux, 1 Link Page, 1 membre, 0 siège VA, 20 publications programmées, 20 messages IA et 0 automatisation.

Le forfait Standard coûte 9 USD par mois et comprend 10 comptes sociaux, 5 Link Pages, 3 membres, 2 sièges VA, 100 publications programmées, 250 messages IA et 5 automatisations. Le forfait Pro coûte 29 USD par mois et comprend 50 comptes sociaux, 20 Link Pages, 10 membres, 9 sièges VA, 500 publications programmées, 750 messages IA et 25 automatisations. Le forfait Business coûte 99 USD par mois et comprend 150 comptes sociaux, un nombre illimité de Link Pages, 30 membres, 29 sièges VA, 2 000 publications programmées, 2 000 messages IA et 100 automatisations.

La base Supabase reste l’autorité. Les triggers SQL contrôlent les comptes sociaux, Link Pages, publications programmées, sièges membres/VA, automatisations et messages IA. Les données existantes ne sont pas supprimées lorsqu’un abonnement expire : le forfait effectif retombe sur Free et bloque les nouveaux ajouts qui dépassent les limites. L’essai est de 7 jours et la période de grâce de paiement est de 7 jours.

Une incohérence d’interface historique a été corrigée : les textes ne prétendent plus que X est « bientôt disponible » ni que les tokens sociaux ne sont pas enregistrés. Les tokens autorisés sont chiffrés côté serveur. Les textes précisent désormais que l’activation réelle dépend des credentials, scopes et validations officielles.

## SASPay : connexion préparée, activation réelle encore bloquée

La couche de paiement est correctement préparée côté architecture. La migration 0012 contient les transactions idempotentes, les références internes, les événements webhook, les factures, la vérification du montant, l’application du résultat uniquement par `service_role`, l’activation du nouveau plan et la période de grâce. Le routeur billing refuse le checkout tant que l’adaptateur SASPay n’est pas officiellement implémenté. Aucun paiement simulé n’est exécuté.

Le blocage est volontaire et précis : le projet ne contient pas le contrat officiel SASPay permettant de connaître l’URL de création de paiement, le schéma de requête, l’authentification, les noms des champs de retour, la signature webhook, l’en-tête de signature, l’algorithme, le format de l’événement, la sandbox et les statuts de remboursement ou d’annulation. Le fichier `server/integrations/saspay.ts` refuse donc toujours la création et tous les webhooks par défaut. Il serait dangereux d’inventer ce protocole.

Pour activer SASPay, il reste à fournir la documentation officielle ou un exemple signé de sandbox. Il faudra alors implémenter l’adaptateur dans `createSaspayCheckout`, implémenter `verifySaspayWebhook`, vérifier la correspondance référence/montant/devise, conserver l’idempotence existante, tester les doublons et les signatures invalides, puis seulement passer `SASPAY_ADAPTER_IMPLEMENTED` à `true`. Les quatre variables serveur restent nécessaires : `SASPAY_API_KEY`, `SASPAY_API_SECRET`, `SASPAY_WEBHOOK_SECRET` et `SASPAY_BASE_URL`.

## Analytics des réseaux sociaux

L’audit officiel est détaillé dans [RECHERCHE-ANALYTICS-RESEAUX-20261116.md](./RECHERCHE-ANALYTICS-RESEAUX-20261116.md). L’état produit est le suivant.

Instagram, Facebook Pages, YouTube, Threads, LinkedIn et X exposent des Analytics officielles, mais TrafficFlow ne possède pas encore de collecteur, de stockage de snapshots ni de job planifié pour ces métriques. TikTok expose dans le périmètre audité surtout des compteurs publics de profil et de vidéo ; il ne faut pas le présenter comme une suite native complète d’insights.

Le prochain socle technique doit ajouter un modèle normalisé de métriques, des snapshots idempotents par compte et média, un job planifié, le suivi des quotas, le backoff, la rotation/actualisation des tokens et les règles de rétention. Il faut ensuite ajouter les collecteurs dans l’ordre recommandé : YouTube/Instagram, Facebook/Threads, X, TikTok, puis LinkedIn après obtention de l’accès Community Management.

Les scopes ajoutés dans cette passe ne suffisent pas à rendre les Analytics opérationnelles. Les comptes déjà connectés doivent être réautorisés. Meta peut demander Advanced Access et Business Verification pour des comptes clients ; Threads, TikTok, YouTube, LinkedIn et X ont leurs propres revues, limites ou coûts.

## Ce qui reste à faire techniquement

1. Obtenir le contrat officiel SASPay de production et de sandbox, puis terminer et tester l’adaptateur sans modifier les garde-fous de montant, référence, signature et idempotence.
2. Ajouter le schéma Supabase des snapshots Analytics et les collecteurs officiels par réseau, avec les fenêtres, latences, métriques dépréciées et limites propres à chaque fournisseur.
3. Implémenter le refresh serveur des tokens sociaux. L’access token est actuellement stocké chiffré, mais les tâches planifiées ne renouvellent pas encore automatiquement les tokens expirés.
4. Finaliser les statuts asynchrones TikTok, Threads et éventuellement YouTube, afin qu’un identifiant d’opération ne soit pas présenté comme une publication confirmée avant le statut final.
5. Compléter l’upload média LinkedIn et X, ainsi que les validations de taille, format et URL publique. Le worker refuse volontairement le média X tant que l’upload v2 n’est pas implémenté.
6. Corriger l’identité TikTok et la sélection Facebook/LinkedIn : récupérer les profils et Pages administrés, demander un choix explicite lorsqu’il y a plusieurs assets et vérifier les rôles nécessaires.
7. Ajouter les tests déterministes du dispatch post-publication, des conditions de workflow, des notifications par rôle et des erreurs d’automatisation. Les tests actuels couvrent la base existante mais aucun appel réel aux fournisseurs.
8. Configurer les applications développeur, les redirect URIs, les secrets Vercel, les permissions, App Reviews, Business Verification et les comptes de test de chaque plateforme.
9. Appliquer les migrations Supabase additives dans l’ordre prévu, sans rejouer 0012 : `0013`, `0014`, puis `0015`. La migration 0015 doit être appliquée avant le cron de publication.
10. Effectuer une recette réelle contrôlée : connexion de chaque réseau, publication privée de test, expiration/refresh de token, échec fournisseur, retry contrôlé, déclenchement d’automatisation et réception d’un webhook de paiement SASPay.

## Validation locale de cette passe

La vérification TypeScript réussit avec `pnpm check` et le build Vite/esbuild réussit ; seul le warning Vite de taille de bundle subsiste. Les 38 tests déterministes métier passent. Le 39e test d’intégration `server/supabase.credentials.test.ts` est volontairement non exécutable dans le Sandbox, car `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` ne sont pas fournis ; il devra être lancé dans l’environnement de déploiement avec une clé publishable (jamais une service-role). Aucun credential réel, paiement réel, migration distante ou publication sociale réelle n’a été exécuté dans le Sandbox.

## Références officielles

Les URLs ci-dessous sont les sources utilisées pour l’analyse des capacités et limites. Les détails par réseau et les écarts précis avec le code sont conservés dans le rapport Analytics lié plus haut.

[1]: https://developers.facebook.com/documentation/instagram-platform/insights "Instagram Insights"
[2]: https://developers.facebook.com/docs/graph-api/reference/page/insights/ "Facebook Page Insights"
[3]: https://developers.google.com/youtube/analytics/reference/reports/query "YouTube Analytics reports.query"
[4]: https://developers.facebook.com/documentation/threads/insights "Threads Insights"
[5]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-10 "LinkedIn organization share statistics"
[6]: https://docs.x.com/x-api/fundamentals/metrics "X API metrics"
[7]: https://developers.tiktok.com/doc/tiktok-api-v2-video-query "TikTok video query"
