# Audit LinkedIn Marketing & Community Management APIs pour TrafficFlow

**Date de vérification : 16 novembre 2026**  
**Périmètre :** documentation officielle LinkedIn/Microsoft Learn ouverte et vérifiée, avec comparaison aux fichiers `server/integrations/social-oauth.ts` et `server/integrations/social-publishers.ts`. Aucun fichier de code n’a été modifié.

## Conclusion opérationnelle

LinkedIn expose bien des analytics exploitables côté serveur pour les Pages d’organisation et pour les publications d’un membre. La Community Management API fournit notamment les statistiques de followers, de Page, de shares, les actions sociales et les analytics vidéo. Les analytics d’un membre comprennent impressions, membres atteints, repartages, réactions, commentaires et, dans la version Marketing 202604–202610, sauvegardes, envois, clics de liens, clics de CTA Premium, abonnés gagnés grâce au contenu et visites de profil générées par le contenu [1] [4].

L’intégration actuelle de TrafficFlow ne peut toutefois pas utiliser ces analytics : elle ne demande que `openid`, `profile` et `w_member_social`, alors que les permissions analytiques et organisationnelles sont accordées par le produit Community Management et nécessitent notamment `r_member_postAnalytics`, `r_member_profileAnalytics`, `r_organization_social`, `w_organization_social` et/ou `rw_organization_admin` selon le cas [2]. Le code ne découvre pas les Pages administrées, ne valide pas les rôles LinkedIn, n’a aucun collecteur analytics et publie uniquement du texte. En l’état, l’OAuth LinkedIn présente aussi un défaut bloquant : l’échange de code ne transmet pas `grant_type=authorization_code`, paramètre requis par la documentation officielle [7].

## Capacités Analytics actuellement documentées

### Analytics de Page et d’organisation

Les endpoints REST versionnés suivants sont documentés et utilisables par un serveur avec un jeton membre autorisé :

- `GET https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity={organization URN}` : statistiques de followers à vie ou bornées dans le temps. Les données à vie peuvent être segmentées par association employé, pays/région, zone géographique, fonction, industrie, séniorité et taille d’entreprise. Les résultats d’une facette sont limités aux 100 premiers éléments. Les requêtes temporelles acceptent `DAY`, `WEEK` ou `MONTH`; les comptes temporels sont agrégés et ne sont pas ventilés par facette [3].
- `GET https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization={organization URN}` et l’équivalent `brandPageStatistics` : statistiques de vues et clics de Page, à vie ou sur une période `DAY`/`MONTH`. Les vues distinguent notamment mobile, desktop, global et certaines sections de Page [5].
- `GET https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity={organization URN}` : statistiques organiques de shares, notamment clics, commentaires, engagement, impressions, impressions uniques, réactions et repartages. L’endpoint ne compte pas l’activité sponsorisée et ne couvre qu’une fenêtre glissante des 12 derniers mois; il ne supporte pas la pagination [6]. Pour le sponsorisé, LinkedIn renvoie vers Ad Analytics, qui relève d’un autre produit et d’autres permissions.

La permission documentée pour les statistiques d’organisation est `rw_organization_admin`, restreinte aux organisations où le membre authentifié possède le rôle `ADMINISTRATOR`. La documentation de contrôle d’accès indique aussi `r_organization_admin` pour lire les Pages et leurs données de reporting, y compris followers, visiteurs et contenu; les rôles `ANALYST` et `CURATOR` ont des droits analytiques dans l’interface, mais il faut vérifier que la permission API approuvée et le rôle du membre couvrent précisément chaque endpoint [9].

### Analytics de publications et de membres

`memberCreatorPostAnalytics` permet d’obtenir les statistiques d’un post précis avec le finder `entity`, ou des statistiques agrégées des posts du membre avec le finder `me`. La permission est `r_member_postAnalytics` [4]. Les métriques documentées pour Marketing 202610 sont : `IMPRESSION`, `MEMBERS_REACHED`, `RESHARE`, `REACTION`, `COMMENT`, `POST_SAVE`, `POST_SEND`, `LINK_CLICKS`, `PREMIUM_CTA_CLICKS`, `FOLLOWER_GAINED_FROM_CONTENT` et `PROFILE_VIEW_FROM_CONTENT`. L’agrégation peut être `TOTAL` ou `DAILY`, avec des restrictions : `DAILY` n’est pas supporté pour `MEMBERS_REACHED`, `LINK_CLICKS`, `FOLLOWER_GAINED_FROM_CONTENT` ni `PROFILE_VIEW_FROM_CONTENT`. Sans `dateRange`, la réponse porte sur la durée de vie du post; avec `dateRange`, l’intervalle est inclusif au début et exclusif à la fin [4].

La page Community Management recense également `r_member_profileAnalytics` pour les analytics de profil membre, `Video Analytics` pour les vidéos de membre ou d’organisation (watch time, vues vidéo, spectateurs), ainsi que les Social Metadata APIs pour les réactions et commentaires des posts, organiques ou sponsorisés [1] [2]. Les actions sociales à jour d’un share sont séparées des statistiques agrégées de share; TrafficFlow devra donc choisir explicitement entre métriques historiques/agrégées et compteurs d’engagement live.

## Publication et endpoints réellement utilisables côté serveur

La publication organique moderne se fait avec :

`POST https://api.linkedin.com/rest/posts`

Le corps texte minimal documenté comprend `author` (URN `urn:li:organization:{id}` ou URN membre), `commentary`, `visibility`, `distribution`, `lifecycleState` et `isReshareDisabledByAuthor`. Le serveur doit envoyer `Authorization: Bearer ...`, `Linkedin-Version: YYYYMM`, `X-Restli-Protocol-Version: 2.0.0` et un type JSON [8]. La réponse de création est `201`; l’identifiant fiable est dans l’en-tête `x-restli-id`, par exemple `urn:li:share:...` ou `urn:li:ugcPost:...`, et pas nécessairement dans un champ JSON `id` [8].

Les images, vidéos et documents ne sont pas transmis par une URL publique directement dans le post. Il faut d’abord téléverser l’asset avec l’Images API, Videos API ou Documents API, puis placer l’URN obtenu dans le corps du post. Les posts organiques supportent texte, image, vidéo, document, article, multi-image, sondage et célébration; les carrousels organiques ne sont pas supportés [8]. Pour un article, l’API ne fait pas de scraping automatique de l’URL : le client doit fournir les champs article et, le cas échéant, un thumbnail déjà téléversé [8].

La lecture des posts et actions d’organisation exige généralement `r_organization_social` et un rôle de Page adéquat; l’écriture exige `w_organization_social` et un rôle `ADMINISTRATOR`, `DIRECT_SPONSORED_CONTENT_POSTER` ou `CONTENT_ADMINISTRATOR`. Pour un profil membre, `w_member_social` permet de publier, tandis que `r_member_social` est une permission restreinte, réservée aux utilisateurs approuvés [8].

## OAuth, permissions, conditions de compte et quotas

Toutes les permissions Marketing sont des permissions membre en OAuth 3-legged : le membre doit consentir aux scopes et l’application doit avoir obtenu l’accès au produit correspondant. Les scopes réellement disponibles dépendent des produits ou programmes approuvés dans l’onglet Auth de l’application; demander un scope non provisionné ne suffit pas [2] [7].

La matrice officielle Community Management déclare notamment : `r_organization_followers`, `r_organization_social`, `r_organization_social_feed`, `rw_organization_admin`, `w_organization_social`, `w_organization_social_feed`, `r_member_profileAnalytics` et `r_member_postAnalytics`, en plus de permissions générales. L’accès est donc à demander explicitement dans l’application, puis à obtenir via l’examen LinkedIn [2].

Les Community Management APIs sont réservées aux organisations légales enregistrées, pour des cas d’usage commerciaux. LinkedIn demande une adresse e-mail professionnelle vérifiable, le nom légal, l’adresse enregistrée, le site et la politique de confidentialité; une Page LinkedIn de la même organisation doit avoir vérifié l’application par un super-admin. Pour le Standard tier, il faut d’abord intégrer et tester le Development tier, puis fournir description, identifiants de test et une screencast montrant les cas d’usage demandés [10].

Le Development tier impose actuellement, sur une fenêtre de 24 heures, **500 appels par application** et **100 appels par membre**. Les APIs avec `BATCH_GET` n’autorisent aucun appel dans ce tier et les webhooks Social Actions sont désactivés. Le développement doit être réalisé dans les douze mois suivant l’octroi. Le Standard tier est présenté comme sans ces restrictions, mais reste soumis à approbation [1] [2]. Ces quotas doivent être traités comme des quotas de collecte : cache, backoff, déduplication et journalisation des réponses sont nécessaires avant tout job périodique d’analytics.

Les données membre sont fortement limitées : usage seulement pour gérer les Pages ou profils via l’application, pas d’usage publicité/vente/recrutement, pas d’export ou transfert hors de l’application, pas de combinaison avec d’autres sources pour enrichir des profils, et conservation très courte (activité sociale membre jusqu’à 48 heures; la plupart des données de profil jusqu’à 24 heures). Les flux sociaux génériques et l’affichage d’un social feed sont interdits par les restrictions Marketing API [11].

Toutes les requêtes versionnées doivent avoir `Linkedin-Version` au format `YYYYMM` et `X-Restli-Protocol-Version: 2.0.0`. La version courante affichée par la documentation au 16 novembre 2026 est `202610`. Les versions sont publiées mensuellement et maintenues au minimum un an. La version `202511` est annoncée comme sunset le 16 novembre 2026; il faut donc éviter tout fallback non versionné et planifier la migration annuelle [12].

L’Authorization Code flow utilise `GET https://www.linkedin.com/oauth/v2/authorization` puis `POST https://www.linkedin.com/oauth/v2/accessToken`. Le `redirect_uri` doit correspondre exactement à une URL configurée; `scope` est une liste séparée par espaces; `state` doit protéger contre CSRF. Le code d’autorisation expire après 30 minutes. Les access tokens actuellement documentés ont une durée de vie de 60 jours et la réponse peut contenir un refresh token ainsi que sa durée de vie [7].

## Comparaison avec le code TrafficFlow

### Points déjà alignés

- `social-oauth.ts` utilise les URLs OAuth officielles LinkedIn et une liste de scopes séparée par espaces, conformément au protocole.
- Le serveur signe et vérifie un `state`, chiffre les tokens au repos et utilise le endpoint OIDC `/v2/userinfo` pour identifier le membre.
- `social-publishers.ts` utilise le nouvel endpoint `/rest/posts`, la version `LINKEDIN_API_VERSION` avec défaut `202610`, `X-Restli-Protocol-Version: 2.0.0` et un corps texte proche de l’exemple officiel.
- Le jeton est consommé côté serveur et non exposé dans le navigateur.

### Écarts bloquants ou importants

1. **Échange OAuth incomplet.** Dans `exchange()` (`social-oauth.ts`, ligne 43), la branche LinkedIn tombe dans le `else` commun et envoie `client_id`, `client_secret`, `code` et `redirect_uri`, mais pas `grant_type: "authorization_code"`. Ce champ est requis par l’endpoint officiel; le callback risque donc un HTTP 400 et aucun compte ne sera connecté.
2. **Scopes insuffisants pour une plateforme Page/analytics.** La configuration demande seulement `openid`, `profile`, `w_member_social`. Elle ne demande aucune permission Community Management d’organisation (`rw_organization_admin`, `r_organization_admin`, `r_organization_social`, `w_organization_social`) ni analytics membre (`r_member_postAnalytics`, `r_member_profileAnalytics`). Ces scopes ne seront utilisables qu’après approbation du produit et consentement renouvelé.
3. **Mauvais modèle d’identité pour les Pages.** `identity()` appelle seulement `https://api.linkedin.com/v2/userinfo` et enregistre le `sub` comme compte LinkedIn. Cela identifie le membre, pas les organisations administrées. Il manque une découverte de rôles via `organizationAcls` et un choix d’URN Page; TrafficFlow ne peut donc pas publier ou lire les analytics d’une Page à partir d’un simple identifiant membre.
4. **Rôles non contrôlés.** Avant publication ou reporting, le serveur devrait vérifier le rôle approuvé et la Page cible. L’API exige notamment ADMINISTRATOR pour les statistiques d’organisation et des rôles précis pour publier/lire le contenu de Page.
5. **Média non implémenté.** `publishLinkedIn()` ignore `mediaUrl` et envoie toujours un post texte. L’API officielle exige upload et URN pour image, vidéo ou document. Une demande TrafficFlow avec média ne peut donc pas être considérée comme publiée correctement.
6. **Identifiant de publication mal extrait.** Le code retourne `body.id`, alors que la documentation dit que le Post ID est dans l’en-tête `x-restli-id` d’une réponse `201`. `jsonRequest()` ne renvoie que le JSON et perd les headers; le worker peut produire un résultat vide malgré une publication réussie.
7. **Pas d’analytics.** Aucun endpoint `organizationalEntityFollowerStatistics`, `organizationPageStatistics`, `organizationalEntityShareStatistics` ou `memberCreatorPostAnalytics` n’est appelé. Il manque aussi la normalisation des URNs, les fenêtres temporelles, la pagination applicable, le cache et la gestion des quotas.
8. **Version configurable mais non validée.** Le défaut `202610` est cohérent avec la documentation consultée, mais `LINKEDIN_API_VERSION` peut être configuré vers une version sunset ou future sans validation. Une version retirée provoque une erreur; une politique de migration et une alerte avant sunset sont nécessaires.
9. **Rotation/expiration incomplète.** Le code stocke `refresh_token` seulement si présent et calcule `expiresAt` à partir de `expires_in`, mais n’exploite pas `refresh_token_expires_in` et ne met pas en œuvre le renouvellement avant expiration. Les tokens LinkedIn étant actuellement documentés à 60 jours, une tâche serveur de rotation est nécessaire pour la publication et les jobs analytics.
10. **Contraintes de données absentes.** Le modèle de persistance ne montre pas de TTL ou de distinction entre données de contenu membre, métriques agrégées et données de Page. Les règles de 24/48 heures, de minimisation et d’interdiction de transfert doivent être reflétées dans le stockage et les exports TrafficFlow.

## Gap TrafficFlow priorisé

- **P0 :** ajouter `grant_type`, revalider l’échange OAuth et tester un callback réel avec les headers/redirect URI exacts.
- **P0 :** décider si TrafficFlow cible les profils membres, les Pages, ou les deux; demander uniquement les scopes du cas d’usage approuvé et faire renouveler le consentement après changement.
- **P0 :** implémenter la découverte `organizationAcls`, la sélection de Page, le stockage de l’URN organisation et le contrôle du rôle avant chaque opération.
- **P1 :** corriger la publication pour lire `x-restli-id`, gérer les statuts HTTP 201 et supporter les uploads d’assets LinkedIn avant `/rest/posts`.
- **P1 :** implémenter les collecteurs analytics avec `Linkedin-Version`, quotas 500/100 du Development tier, backoff, cache et fenêtre de 12 mois pour les share statistics.
- **P1 :** mapper les métriques vers le schéma d’analytics TrafficFlow en distinguant Page, post membre, post organisation, organique et sponsorisé; ne pas présenter `organizationalEntityShareStatistics` comme un rapport Ads.
- **P1 :** ajouter renouvellement et révocation des tokens, stockage des durées de vie et observabilité des erreurs 401/403/429.
- **P2 :** documenter la politique de conservation, les limites d’affichage des données membre et l’absence de social feed; faire correspondre la screencast et la privacy policy aux cas d’usage soumis à LinkedIn.

## Sources officielles

[1]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2026-10 "Community Management - Overview"
[2]: https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-10 "Increasing Access and API Permissions"
[3]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/follower-statistics?view=li-lms-2026-10 "Organization Follower Statistics"
[4]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-10 "Member Post Statistics"
[5]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/page-statistics?view=li-lms-2026-10 "Organization Page Statistics"
[6]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-10 "Organization Share Statistics"
[7]: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow?view=li-lms-2026-10 "LinkedIn Authorization Code Flow"
[8]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10 "Posts API"
[9]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-10 "Organization Access Control by Role"
[10]: https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2026-10 "Community Management App Review"
[11]: https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases?view=li-lms-2026-10 "Restricted Uses of LinkedIn Marketing APIs and Data"
[12]: https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-10 "LinkedIn Marketing API Versioning"
