# TrafficFlow — synthèse comparative des analytics des réseaux sociaux

**Date de synthèse : 16 novembre 2026**  
**Périmètre :** état des capacités officielles et écart avec l’intégration TrafficFlow auditée.  
**Principe :** « activable maintenant » signifie que l’API et le parcours d’accès sont documentés et exploitables avec les capacités déjà présentes ou avec une activation limitée. Cela ne signifie pas que le collecteur Analytics est déjà implémenté dans TrafficFlow.

## Vue d’ensemble

| Réseau | Analytics natifs | Activable maintenant | Principal blocage produit/code |
|---|---|---|---|
| Instagram | Oui : compte et média | Publication déjà exploitable pour comptes professionnels ; Analytics après ajout du scope et activation Meta | Aucun endpoint `/insights`, pas de token long-lived ni de collecte planifiée |
| Facebook Pages | Oui : Page et publication | Publication partiellement conforme ; Analytics après ajout de `read_insights` et validation de Page | Pas de collecteur Insights ni de vérification de la tâche `ANALYZE` |
| TikTok | Partiel : compteurs publics de profil/vidéo, pas de suite d’insights complète | Affichage et publication après scopes supplémentaires et conformité TikTok | Aucun appel Display API ; historique à construire par snapshots |
| YouTube | Oui : YouTube Analytics API et, en complément, Reporting API bulk | OAuth, identification de chaîne et upload déjà couverts ; Analytics après réautorisation | Scope `yt-analytics.readonly` et `reports.query` absents |
| Threads | Oui : insights média et profil | Publication/OAuth de base ; Analytics après `threads_manage_insights` et accès associé | Aucun endpoint Insights, token court stocké sans échange/refresh |
| LinkedIn | Oui : Pages, shares organiques et posts membres | Non immédiatement pour Analytics : accès Community Management et scopes approuvés requis | OAuth LinkedIn incomplet, pas de découverte d’organisations ni de collecteur |
| X | Oui : métriques de posts, privées/organic/promoted sous conditions | Publication texte et lecture de métriques de posts possédés après correction OAuth ; historique à construire | Aucun collecteur, scopes séparés par virgules et pas de refresh effectif |

## 1. Instagram Graph API / Instagram Platform

### Ce qui est activable maintenant

L’analytics Instagram est officiellement disponible avec **Instagram Login** pour un compte professionnel **Business ou Creator**. Les endpoints serveur documentés sont :

- `GET https://graph.instagram.com/v27.0/<INSTAGRAM_ACCOUNT_ID>/insights` pour les insights du compte ;
- `GET https://graph.instagram.com/v27.0/<INSTAGRAM_MEDIA_ID>/insights` pour les insights d’un média.

Les métriques disponibles selon la compatibilité de la métrique comprennent notamment `reach`, `views`, `accounts_engaged`, `likes`, `comments`, `shares`, `saves`, `reposts`, `total_interactions` et certaines données démographiques ou propres aux Reels/Stories. Avec Instagram Login, les métriques sont les métriques organiques documentées ; les agrégats incluant les surfaces publicitaires (`total_comments`, `total_likes`, `total_views`) relèvent de l’Instagram API avec Facebook Login.

La permission analytique à ajouter est `instagram_business_manage_insights`, en conservant `instagram_business_basic`. Le compte doit être professionnel ; un compte personnel n’est pas pris en charge. Standard Access suffit pour les comptes possédés ou gérés et ajoutés à l’application. L’usage de comptes clients hors rôles de l’application demande Advanced Access, Business Verification et les approbations Meta applicables.

### Scopes, revues et limites

Les anciens scopes `business_*` sont dépréciés. Les scopes Instagram pertinents sont `instagram_business_basic`, `instagram_business_content_publish` et `instagram_business_manage_insights`. Les données peuvent être retardées jusqu’à 48 heures ; les webhooks d’insights ne sont pas supportés avec Instagram Login, donc la collecte doit être planifiée côté serveur. Les insights média sont conservés jusqu’à deux ans ; les Stories ont une fenêtre d’insights de 24 heures et les petites audiences peuvent provoquer une erreur plutôt que retourner zéro. Certaines métriques sont indisponibles sous 100 followers, les données démographiques sont limitées et `online_followers` couvre seulement les 30 derniers jours.

Le code doit échanger le token court via `GET https://graph.instagram.com/access_token`, puis le renouveler via `GET https://graph.instagram.com/refresh_access_token`. Les appels sont soumis aux Business Use Case rate limits : il faut suivre les en-têtes d’usage, répartir les requêtes et appliquer un backoff. Pour la publication, les médias doivent être hébergés sur une URL publique et le flux reste `POST /<IG_ID>/media`, vérification du container, puis `POST /<IG_ID>/media_publish`. La documentation générale indique 100 posts API par compte sur 24 heures glissantes, tandis que la référence `media_publish` indique 50 ; appliquer provisoirement la limite conservatrice de 50 et consulter `content_publishing_limit`. La métrique `impressions` est dépréciée à partir de v22.0 et doit être remplacée par `views` dans les nouvelles collectes.

### Travail précis restant dans le code

1. Ajouter `instagram_business_manage_insights` au scope demandé et l’activer dans le tableau de bord Meta.
2. Implémenter les deux appels `/insights`, avec validation des combinaisons `metric`, `period`, `metric_type`, `breakdown`, `timeframe`, `since` et `until`.
3. Implémenter `GET /<IG_ID>/media` et persister les IDs IG Media pour rattacher les insights aux publications TrafficFlow.
4. Implémenter l’échange et le refresh des tokens long-lived ; l’intégration actuelle conserve le token initial et expirera.
5. Centraliser `API_VERSION` : `social-oauth.ts` utilise v27.0 par défaut alors que l’identité Instagram et le publisher utilisent v24.0 en dur.
6. Ajouter une collecte planifiée, idempotente et tolérante au retard de 48 heures.
7. Suivre les quotas, `content_publishing_limit`, les en-têtes d’usage et les erreurs de throttling.
8. Conserver les réponses complètes de publication, notamment `config_issue`, gérer explicitement les statuts de container et remplacer le polling fixe de 30 secondes par une gestion du délai de traitement.
9. Prévoir le parcours Advanced Access, Business Verification et revue Meta pour le multi-client.

**Sources officielles :**
- https://developers.facebook.com/documentation/instagram-platform/overview
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/documentation/instagram-platform/insights
- https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights
- https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights
- https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media
- https://developers.facebook.com/documentation/instagram-platform/content-publishing
- https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media_publish
- https://developers.facebook.com/documentation/development/graph-api/overview/access-levels
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

## 2. Facebook Pages Graph API

### Ce qui est activable maintenant

Les analytics sont disponibles via `GET /{page-id}/insights?metric=...` et `GET /{post-id}/insights?metric=...`. Les métriques actuelles comprennent notamment `page_post_engagements`, `page_media_view`, `page_total_media_view_unique`, `page_follows`, `post_media_view` et des métriques de réactions et de vidéo. La publication est documentée via `POST /{page-id}/feed` avec `pages_manage_posts`; photos et vidéos utilisent les endpoints Page correspondants.

L’accès Analytics nécessite un **Page access token**, une personne disposant de la tâche Page `ANALYZE`, ainsi que `read_insights` et `pages_read_engagement`. Les Pages et leurs tokens se découvrent via `GET /{user-id}/accounts` avec `pages_show_list`. Les system-user tokens peuvent automatiser des actions sous réserve de l’accès aux assets.

### Scopes, revues et limites

L’intégration actuelle demande `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`, mais pas `read_insights`. Les permissions étendues et les fonctions de gestion nécessitent généralement App Review et publication de l’application pour les utilisateurs hors rôles de développement.

Les données sont souvent rafraîchies toutes les 24 heures, l’historique est limité à deux ans et les fenêtres `since`/`until` à 90 jours. Les Page Insights ont un seuil de 100 likes ; les données démographiques un seuil de 100 personnes. Les métriques uniques sont approximatives, les interactions Reels ne sont pas incluses et les anciennes métriques `page_fans`, `page_impressions` et `post_impressions` sont dépréciées. Les requêtes multi-métriques complexes peuvent expirer. Il faut surveiller `X-App-Usage`, les erreurs de throttling et notamment le code 32 ; les tokens peuvent expirer ou être révoqués.

### Travail précis restant dans le code

1. Ajouter `read_insights` à `social-oauth.ts`.
2. Modifier le callback et la sélection d’asset pour exiger, exposer et persister la tâche `ANALYZE`, au lieu de sélectionner seulement une Page avec `CREATE_CONTENT`.
3. Implémenter les endpoints Page/post `/insights`, un modèle de normalisation des séries et la persistance des résultats.
4. Remplacer les métriques dépréciées par un catalogue versionné des métriques actuelles et gérer l’erreur `invalid metric`.
5. Gérer les fenêtres de 90 jours, le rafraîchissement quotidien, les seuils de disponibilité et les résultats démographiques clairsemés.
6. Ajouter suivi des quotas, classification des erreurs Meta, backoff et réduction des requêtes complexes.
7. Remplacer la sélection automatique de la première Page compatible par un choix utilisateur et une validation persistante des tasks.
8. Implémenter le renouvellement/raccordement après expiration ou révocation du token Facebook et couvrir les Webhooks Pages si cette capacité est retenue.

**Sources officielles :**
- https://developers.facebook.com/documentation/pages-api
- https://developers.facebook.com/documentation/facebook-login/guides/access-tokens
- https://developers.facebook.com/docs/graph-api/reference/page/insights/
- https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

## 3. TikTok Content Posting and Display APIs

### Ce qui est activable maintenant

TikTok fournit une analytics **partielle** dans le périmètre audité. `user.info.stats` expose `follower_count`, `following_count`, `likes_count` et `video_count`. `video.query` expose notamment `like_count`, `comment_count`, `share_count` et `view_count`. Les endpoints concernés sont `/v2/user/info/`, `/v2/video/list/` et `/v2/video/query/`.

Il n’existe pas ici de suite d’insights native documentée pour les impressions, la portée, le watch time, la rétention, les données démographiques, les clics ou des séries temporelles. TrafficFlow peut donc construire un historique par collecte périodique, mais ne doit pas le présenter comme des insights natifs complets. Le code possède déjà l’OAuth et des endpoints d’initiation de publication, mais aucun appel Display API.

### Scopes, revues et limites

Les scopes actuels sont `user.info.basic` et `video.publish`. Il manque, selon les fonctionnalités, `video.list`, `user.info.profile`, `user.info.stats` et éventuellement `video.upload` pour le mode `MEDIA_UPLOAD`. Chaque scope doit être approuvé puis autorisé individuellement par l’utilisateur.

L’access token dure 24 heures ; le refresh token est documenté pour 365 jours et peut être renouvelé à chaque refresh. Le nouveau refresh token doit être persisté. Le Display API est limité par défaut à 600 requêtes/minute ; le Content Posting impose notamment 6 requêtes/minute par access token pour l’initialisation et 30 requêtes/minute pour status/fetch.

Un client non audité est limité jusqu’à 5 utilisateurs postants sur 24 heures et peut imposer des comptes privés ou une visibilité `SELF_ONLY`. L’audit est nécessaire pour lever ces restrictions. Les plafonds de créateurs et de publications s’appliquent également. Avant publication, `creator_info/query` est obligatoire afin d’afficher les options du créateur ; la confidentialité doit être choisie explicitement parmi `privacy_level_options`, sans défaut. Il faut gérer consentement, aperçu, disclosure commercial et statut. `PULL_FROM_URL` exige HTTPS sans redirection, URL publique et domaine/préfixe vérifié ; les limites de taille, format, dimensions, FPS et durée doivent être validées.

### Travail précis restant dans le code

1. Ajouter les scopes `video.list`, `user.info.profile` et `user.info.stats` au parcours OAuth, sous réserve de leur approbation.
2. Implémenter `/v2/user/info/`, `/v2/video/list/` et `/v2/video/query/`, puis persister des snapshots périodiques idempotents.
3. Ne pas promettre impressions, portée, watch time, rétention, démographie, clics ou séries natives non exposées par ces APIs.
4. Implémenter `creator_info/query` avant chaque publication, avec `privacy_level_options`, durée maximale, nickname et états comment/duet/stitch.
5. Remplacer `SELF_ONLY` forcé par un choix utilisateur explicite ; prendre en charge la confidentialité requise pour les photos.
6. Prendre en charge `disable_comment`, `disable_duet`, `disable_stitch`, `brand_content_toggle` et `brand_organic_toggle` si ces options font partie du produit.
7. Appeler `/v2/post/publish/status/fetch/`, gérer `PUBLISH_COMPLETE`, `FAILED`, la modération et les webhooks ; ne pas considérer `publish_id` comme le `post_id` final.
8. Implémenter le refresh serveur des tokens, valider URL/domaine/format/taille/FPS/dimensions/durée et remonter les erreurs spécifiques.
9. Corriger `identity()` pour récupérer username/display name/statistiques via `/v2/user/info/`, plutôt que d’utiliser `open_id` comme handle.
10. Traiter le payload photo, les champs UX/commerciaux et, si nécessaire, les carrousels jusqu’à 35 URLs.

**Sources officielles :**
- https://developers.tiktok.com/doc/display-api-overview?enter_method=left_navigation
- https://developers.tiktok.com/doc/tiktok-api-v2-video-list
- https://developers.tiktok.com/doc/tiktok-api-v2-video-query
- https://developers.tiktok.com/doc/tiktok-api-v2-video-object
- https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
- https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status
- https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
- https://developers.tiktok.com/doc/content-sharing-guidelines
- https://developers.tiktok.com/doc/scopes-overview
- https://developers.tiktok.com/doc/oauth-user-access-token-management
- https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit?enter_method=left_navigation

## 4. YouTube Data API et YouTube Analytics API

### Ce qui est activable maintenant

YouTube Analytics est disponible pour une chaîne autorisée via :

`GET https://youtubeanalytics.googleapis.com/v2/reports`

avec `ids=channel==MINE` ou `channel==CHANNEL_ID`, `startDate`, `endDate`, `metrics` et, selon le rapport, `dimensions`, `filters` et `sort`. Les métriques comprennent notamment `views`, `comments`, `likes`, `shares`, `estimatedMinutesWatched`, `averageViewDuration`, `subscribersGained` et `subscribersLost`, ainsi que certaines métriques publicitaires et de revenu sous conditions. Les données de chaîne sont limitées à la chaîne possédée ou administrée par l’identité OAuth.

Le code couvre déjà OAuth Google, l’identification de chaîne et l’upload vidéo via YouTube Data API v3. Il manque toutefois le scope `https://www.googleapis.com/auth/yt-analytics.readonly`. Il faut conserver `https://www.googleapis.com/auth/youtube.readonly` et ajouter le scope Analytics, puis obtenir une réautorisation des connexions existantes. Les rapports bulk asynchrones restent possibles via YouTube Reporting API (`reportTypes.list`, `jobs.create`, `jobs.reports.list`) mais ne sont pas nécessaires pour un dashboard ciblé.

### Scopes, revues et limites

Les données Analytics ont typiquement 48 à 72 heures de latence et l’`endDate` effectif s’arrête au dernier jour où toutes les métriques demandées sont disponibles. Les données à faible trafic peuvent être anonymisées ou omises. Chaque requête Analytics compte dans le quota Analytics, distinct du quota YouTube Data API.

Les métriques de revenu ou de performance publicitaire exigent `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` et des conditions d’accès supplémentaires ; ce scope ne doit pas être demandé par défaut. Les rapports content owner sont réservés aux partenaires de contenu et chaînes liées. OAuth web serveur doit utiliser `access_type=offline` et conserver le refresh token de façon sécurisée ; les scopes sensibles/restricts peuvent déclencher la vérification Google. Les métadonnées Data API identifiées par Analytics doivent être supprimées ou rafraîchies après 30 jours selon les politiques citées.

### Travail précis restant dans le code

1. Ajouter `https://www.googleapis.com/auth/yt-analytics.readonly` à `YouTube.scopes` et déclencher la réautorisation.
2. Implémenter `GET https://youtubeanalytics.googleapis.com/v2/reports`.
3. Parser `columnHeaders` et `rows`, valider les combinaisons `metrics`/`dimensions`/`filters` et synchroniser l’historique.
4. Consommer réellement le refresh token stocké lorsque l’access token expire, notamment pour les tâches serveur planifiées.
5. Ajouter `videos.list` pour les statistiques courantes, en complément de l’Analytics pour les tendances.
6. Remplacer l’upload multipart en mémoire par un upload resumable pour permettre la reprise réseau sur les gros fichiers.
7. Ne pas étendre par défaut au scope monétaire ; si les revenus sont demandés, ajouter justification produit, disclosures et vérification Google adaptés.
8. Le publisher force actuellement `privacyStatus=private` : prendre en charge public, non répertorié ou planifié si le produit l’exige.
9. Envisager YouTube Reporting API bulk uniquement pour les exports historiques/volumiques.

**Sources officielles :**
- https://developers.google.com/youtube/data/guides/authentication
- https://developers.google.com/youtube/data/getting-started
- https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- https://developers.google.com/youtube/analytics
- https://developers.google.com/youtube/analytics/reference/reports/query
- https://developers.google.com/youtube/analytics/reference
- https://developers.google.com/youtube/analytics/data_model
- https://developers.google.com/youtube/analytics/channel_reports
- https://developers.google.com/youtube/reporting/v1/reports
- https://support.google.com/cloud/answer/9110914
- https://support.google.com/cloud/answer/13464321
- https://developers.google.com/youtube/terms/developer-policies

## 5. Threads API

### Ce qui est activable maintenant

Threads documente :

- `GET /{threads-media-id}/insights` pour `views`, `likes`, `replies`, `reposts`, `quotes` et `shares` ;
- `GET /{threads-user-id}/threads_insights` pour `views`, `likes`, `replies`, `reposts`, `quotes`, `clicks`, `followers_count` et `follower_demographics`.

Les insights exigent `threads_basic` et `threads_manage_insights`. TrafficFlow couvre aujourd’hui l’OAuth de base et la publication simple, mais ne possède aucun collecteur Analytics.

### Scopes, revues et limites

`threads_basic` est obligatoire ; `threads_content_publish` est requis pour publier. Les scopes supplémentaires couvrent les réponses, découverte, mentions, suppressions et lieux. Les utilisateurs sans rôle sur l’application nécessitent App Review et une app publiée ; en test, un Threads Tester doit être invité et accepter.

Les tokens courts sont valables une heure ; les tokens longs 60 jours et doivent être rafraîchis côté serveur. Les grants sont valables 90 jours pour les profils publics ; un profil privé doit réautoriser à expiration. Les périodes utilisateur ont par défaut une fenêtre de deux jours ; les dates avant Unix 1712991600 sont rejetées. `followers_count` et les démographies n’acceptent pas `since`/`until`, et `follower_demographics` exige au moins 100 abonnés. `views` et `shares` sont marquées en développement ; les métriques média n’incluent pas les réponses imbriquées.

Les médias doivent être servis par une URL publique. Meta recommande d’attendre environ 30 secondes puis de vérifier le statut. Le quota est de 250 posts par profil sur 24 heures glissantes, 1 000 réponses et 100 suppressions ; il existe aussi un call count applicatif calculé sur 24 heures. Les contraintes de contenu incluent 500 caractères, carrousels de 2 à 20 enfants, image jusqu’à 8 MB et vidéo jusqu’à 5 minutes/1 GB.

### Travail précis restant dans le code

1. Ajouter `threads_manage_insights` au parcours OAuth et traiter App Review/app publiée ou Threads Tester.
2. Implémenter les endpoints media et `threads_insights`, avec collecte, normalisation et persistance.
3. Remplacer l’échange simple du code par l’échange long-lived `access_token?grant_type=th_exchange_token`, puis implémenter `refresh_access_token`.
4. Utiliser le couple Threads App ID/App Secret dédié au use case Threads, sans fallback silencieux vers `META_APP_ID/META_APP_SECRET` si les credentials dédiés manquent.
5. Remplacer l’attente fixe de 3 secondes avant `threads_publish` par environ 30 secondes et un contrôle de statut.
6. Suivre `threads_publishing_limit` et réserver le quota avant publication planifiée.
7. Valider texte UTF-8, tailles, formats, ratios et durée vidéo ; implémenter carrousels si requis.
8. Laisser explicitement hors périmètre les réponses, mentions, suppressions, webhooks, découverte et `is_made_with_ai` tant qu’ils ne sont pas développés.

**Sources officielles :**
- https://developers.facebook.com/documentation/threads
- https://developers.facebook.com/documentation/threads/overview
- https://developers.facebook.com/documentation/threads/get-started
- https://developers.facebook.com/documentation/threads/get-started/get-access-tokens-and-permissions
- https://developers.facebook.com/documentation/threads/get-started/long-lived-tokens
- https://developers.facebook.com/documentation/threads/insights
- https://developers.facebook.com/documentation/threads/posts
- https://developers.facebook.com/documentation/threads/reference/user
- https://developers.facebook.com/documentation/threads/webhooks

## 6. LinkedIn Marketing & Community Management APIs

### Ce qui est activable maintenant

LinkedIn documente les endpoints suivants :

- `organizationalEntityFollowerStatistics` : followers à vie ou temporels et facettes démographiques ;
- `organizationPageStatistics` / `brandPageStatistics` : vues et clics de Page ;
- `organizationalEntityShareStatistics` : clics, commentaires, engagement, impressions, impressions uniques, réactions et repartages organiques sur une fenêtre glissante de 12 mois ;
- `memberCreatorPostAnalytics` : analytics d’un post ou agrégés par membre, avec les métriques Marketing 202610 telles que impressions, membres atteints, repartages, réactions, commentaires, sauvegardes, envois, clics de liens, CTA Premium, abonnés gagnés et visites de profil.

Ces capacités ne sont pas activables immédiatement dans TrafficFlow. Elles exigent un accès Community Management approuvé, un jeton membre OAuth 3-legged et les rôles d’organisation appropriés. Les endpoints versionnés doivent inclure `Linkedin-Version: 202610` et `X-Restli-Protocol-Version: 2.0.0` ; la version 202511 est annoncée sunset le 16 novembre 2026.

### Scopes, revues et limites

Les permissions dépendent des produits approuvés. Les scopes pertinents comprennent `r_organization_followers`, `r_organization_social`, `r_organization_social_feed`, `rw_organization_admin`, `w_organization_social`, `w_organization_social_feed`, `r_member_profileAnalytics` et `r_member_postAnalytics`. Les statistiques de Page/followers nécessitent notamment `rw_organization_admin` et le rôle `ADMINISTRATOR`; `r_member_postAnalytics` est requis pour `memberCreatorPostAnalytics`.

Le Development tier est limité à 500 appels par application et 100 par membre sur 24 heures ; aucun BATCH_GET et les webhooks Social Actions sont désactivés. Le Standard tier nécessite approbation. Community Management est réservé aux organisations légales enregistrées et cas commerciaux ; LinkedIn demande notamment email professionnel, identité, adresse, site, politique de confidentialité et vérification par un super-admin. Les tokens durent actuellement 60 jours et peuvent fournir un refresh token ; le code d’autorisation expire après 30 minutes et le `redirect_uri` doit correspondre exactement.

Les données membre sont soumises à une forte minimisation : activité sociale membre jusqu’à 48 heures et la plupart des données de profil jusqu’à 24 heures. Elles ne doivent pas servir à publicité, vente ou recrutement, ni être exportées/agrégées avec d’autres données. Les social feeds génériques sont interdits.

### Travail précis restant dans le code

1. **P0 :** corriger l’échange OAuth LinkedIn de `social-oauth.ts` en envoyant `grant_type=authorization_code`.
2. **P0 :** demander les scopes Community Management/analytics approuvés, au lieu de seulement `openid`, `profile` et `w_member_social`.
3. **P0 :** découvrir `organizationAcls`, les Pages administrées et les URN d’organisation ; vérifier les rôles.
4. **P1 :** implémenter les quatre familles d’endpoints Analytics, quotas, fenêtre glissante, cache, backoff et TTL/minimisation.
5. **P1 :** corriger la publication média : upload d’image/vidéo/document puis URN d’asset, au lieu d’ignorer `mediaUrl`.
6. **P1 :** lire l’identifiant de post dans l’en-tête `x-restli-id` de la réponse 201 ; `jsonRequest()` doit préserver les headers.
7. **P1 :** valider `LINKEDIN_API_VERSION`, alerter avant sunset et stocker/renouveler `refresh_token_expires_in`.
8. **P2 :** mettre en œuvre une politique visible de TTL/minimisation compatible avec les contraintes sur les données membre.

**Sources officielles :**
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/follower-statistics?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/page-statistics?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases?view=li-lms-2026-10
- https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-10

## 7. X API v2

### Ce qui est activable maintenant

X API v2 permet de lire les métriques d’un post via `GET /2/tweets/{id}` avec `tweet.fields` :

- `public_metrics` : reposts, quotes, likes, replies, impressions et bookmarks ;
- `non_public_metrics` : clics URL, clics profil et engagements ;
- `organic_metrics` ;
- `promoted_metrics` ;
- métriques vidéo via `media.fields` et l’expansion des `media_keys`.

Les métriques privées, organiques et promues nécessitent un contexte utilisateur OAuth et seulement des posts possédés. Elles sont limitées aux posts des 30 derniers jours. Il n’existe pas de dashboard historique complet par compte dans l’API v2 standard : TrafficFlow doit persister des snapshots périodiques. Les analytics de campagnes relèvent de X Ads API, distincte de X API v2.

La publication texte via `POST /2/tweets` est couverte par le code, mais les scopes sont actuellement concaténés avec des virgules alors que la documentation OAuth exige des scopes séparés par des espaces. Après correction, la publication et la lecture des posts possédés sont activables, sous réserve du plan pay-per-use et des crédits disponibles.

### Scopes, revues et limites

Le parcours serveur est OAuth 2.0 Authorization Code with PKCE. Les scopes pertinents sont `tweet.read`, `tweet.write`, `users.read`, `media.write` et `offline.access`. Sans `offline.access`, l’access token expire par défaut après environ deux heures ; avec lui, X fournit un refresh token. Le callback URL doit correspondre exactement à la Developer Console.

La documentation publiée indique notamment 100 requêtes par utilisateur/15 minutes et 10 000 par application/24 heures pour `POST /2/tweets`, 900 par utilisateur et 450 par application/15 minutes pour `GET /2/tweets/{id}`, et 75 par utilisateur/15 minutes pour `GET /2/users/me`. Il faut lire `x-rate-limit-limit`, `x-rate-limit-remaining` et `x-rate-limit-reset`, et traiter 429.

Le modèle est pay-per-use : les Owned Reads éligibles sont indiquées à 0,001 USD par ressource ; le plan est plafonné à 3 millions de lectures de posts par cycle mensuel. La tarification publiée indique actuellement 0,015 USD par requête standard `POST /2/tweets` et 0,20 USD si le post contient une URL ; ces tarifs doivent être revalidés dans la Developer Console. L’upload média v2 est préalable à `POST /2/tweets`, avec jusqu’à quatre photos, un GIF ou une vidéo. Les limites vidéo dépendent du compte publiant. Les quote-posts via `quote_tweet_id` sont réservés à Enterprise.

### Travail précis restant dans le code

1. Implémenter `GET /2/tweets/{id}` avec les champs `public_metrics`, `non_public_metrics`, `organic_metrics`, `promoted_metrics` et les expansions vidéo appropriées.
2. Ajouter la persistance et la planification de snapshots, sachant que les métriques non publiques/organic/promoted ne couvrent que 30 jours.
3. Corriger la sérialisation des scopes X : espaces, jamais virgules.
4. Implémenter le refresh automatique à partir du refresh token.
5. Ajouter l’upload média v2, l’attachement `media_ids` et les validations de formats/limites.
6. Traiter spécifiquement 401, 403 et 429, lire les headers de rate limit et appliquer un backoff.
7. Suivre crédits, coût, plafond de dépenses et consommation pay-per-use.
8. Vérifier explicitement qu’un post appartient au compte connecté avant de demander les métriques privées.
9. Ne pas implémenter les analytics publicitaires via X API v2 : ils relèvent de X Ads API.

**Sources officielles :**
- https://docs.x.com/x-api/fundamentals/metrics
- https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- https://docs.x.com/x-api/posts/create-post
- https://docs.x.com/x-api/getting-started/pricing
- https://docs.x.com/overview
- https://docs.x.com/x-api/users/get-me
- https://docs.x.com/x-api/fundamentals/rate-limits
- https://docs.x.com/x-api/media/introduction
- https://docs.x.com/changelog

## Ordre de mise en œuvre recommandé

1. **Socle commun :** modèle normalisé de métriques, persistance de snapshots, jobs planifiés idempotents, fenêtres de collecte, TTL, chiffrement/rotation et refresh des tokens, suivi des quotas et backoff.
2. **YouTube et Instagram :** APIs Analytics clairement documentées et directement utiles, après scopes et réautorisation ; traiter dès le départ les latences de 48–72 heures / 48 heures.
3. **Facebook Pages et Threads :** ajouter les permissions et collecteurs Meta, avec validation des tasks, seuils, métriques dépréciées et tokens long-lived.
4. **X :** corriger d’abord le format des scopes, puis implémenter les métriques de posts et les snapshots de 30 jours.
5. **TikTok :** positionner honnêtement l’offre comme compteurs publics + historique TrafficFlow, sans promettre une suite d’insights absente ; compléter Display API et les contrôles de publication.
6. **LinkedIn :** traiter les défauts OAuth P0 avant toute promesse Analytics, puis obtenir Community Management/Standard tier et mettre en place une politique stricte de conservation des données membre.

## Conclusion

Les sept réseaux ne sont pas au même niveau. Instagram, Facebook Pages, YouTube, Threads, LinkedIn et X exposent des analytics officielles, mais **aucun collecteur Analytics correspondant n’est actuellement implémenté dans TrafficFlow** d’après l’audit fourni. TikTok est différent : le périmètre audité expose surtout des compteurs publics et non une suite d’insights native complète ; l’historique doit être produit par TrafficFlow et présenté comme tel.

L’activation technique la plus courte consiste à ajouter les scopes manquants, obtenir la réautorisation lorsque nécessaire, implémenter un collecteur commun avec snapshots et gérer le cycle de vie des tokens. Les revues et accès avancés restent des prérequis séparés : Advanced Access/Business Verification chez Meta pour le multi-client, App Review Threads/Facebook, approbation YouTube pour les scopes sensibles ou monétaires, audit TikTok, accès Community Management LinkedIn et limites/coûts du plan X. Tant que ces étapes et les travaux de code listés par réseau ne sont pas terminés, TrafficFlow ne doit pas présenter l’Analytics comme disponible en production simplement parce que l’API officielle existe.
