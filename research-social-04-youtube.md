# Audit YouTube Data API et YouTube Analytics API pour TrafficFlow

**Date de vérification : 16 novembre 2026**  
**Périmètre :** documentation officielle Google/YouTube et comparaison en lecture seule avec `server/integrations/social-oauth.ts` et `server/integrations/social-publishers.ts`.

## Conclusion opérationnelle

YouTube est intégrable côté serveur pour TrafficFlow avec OAuth 2.0 et des refresh tokens. Le code existant couvre déjà une identité de chaîne (`channels.list?part=id,snippet&mine=true`) et la publication vidéo via `videos.insert`. En revanche, il ne couvre pas actuellement YouTube Analytics : le consentement OAuth ne demande pas `https://www.googleapis.com/auth/yt-analytics.readonly`, aucun appel à `https://youtubeanalytics.googleapis.com/v2/reports` n’est présent, et aucune logique de rafraîchissement du token n’est utilisée par le publisher.

L’Analytics API est adaptée aux tableaux de bord et aux requêtes ciblées par chaîne. Elle expose des métriques de vues, durée de visionnage, likes, commentaires, partages, abonnements gagnés/perdus, sources de trafic, géographie et démographie selon les rapports et seuils applicables. Elle n’est pas temps réel malgré la formulation « real-time queries » de la documentation : le traitement entraîne typiquement 48 à 72 heures de latence. Pour des compteurs courants par vidéo, `videos.list` avec `part=statistics` est l’endpoint Data API approprié.

## Capacités réellement documentées

### YouTube Data API v3

- **Identité de la chaîne authentifiée :** `GET https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true`, avec OAuth. C’est l’appel déjà utilisé par TrafficFlow.
- **Publication vidéo :** `POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status`, avec upload média multipart ou resumable. `videos.insert` crée la vidéo et peut définir titre, description, catégorie et statut de confidentialité. La documentation indique une taille maximale de 256 GB et des MIME types `video/*` ou `application/octet-stream`.
- **Métadonnées/statistiques publiques ou autorisées :** `videos.list`, notamment `part=snippet,statistics,status,contentDetails`, peut récupérer métadonnées et compteurs de la vidéo. Les opérations privées et les écritures exigent OAuth ; les données publiques peuvent utiliser une clé API.
- **Mise à jour et autres ressources :** l’API expose les opérations `list`, `insert`, `update` et `delete` selon la ressource, mais toute écriture nécessite une autorisation utilisateur.

### YouTube Analytics API v2

L’endpoint serveur réellement documenté pour une requête ciblée est :

```text
GET https://youtubeanalytics.googleapis.com/v2/reports
```

Chaque requête doit être autorisée et fournir au minimum :

- `ids=channel==MINE` ou `ids=channel==CHANNEL_ID` pour une chaîne ; les requêtes de content owner utilisent `contentOwner==OWNER_NAME` ;
- `startDate=YYYY-MM-DD` et `endDate=YYYY-MM-DD` ;
- `metrics`, par exemple `views`, `likes`, `comments`, `estimatedMinutesWatched`, `averageViewDuration`, `subscribersGained` ;
- éventuellement `dimensions`, `filters`, `sort` et `maxResults` selon le rapport.

Exemples de capacités utiles à TrafficFlow :

```text
GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2026-01-01&endDate=2026-01-31&metrics=views,likes,comments,estimatedMinutesWatched,subscribersGained&dimensions=day&sort=day
```

```text
GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2026-01-01&endDate=2026-01-31&metrics=views,estimatedMinutesWatched&dimensions=video&filters=video==VIDEO_ID
```

Les combinaisons autorisées dépendent de chaque rapport. Les rapports de chaîne documentent notamment les statistiques de base, les rapports par vidéo, les sources de trafic, les appareils, la géographie, les données démographiques et les playlists. Les métriques de base incluent vues, commentaires, likes, dislikes, partages, minutes regardées estimées, durée moyenne, pourcentage moyen regardé, abonnés gagnés/perdus et, selon l’accès, métriques publicitaires et de revenu.

Les métriques monétaires et de performance publicitaire ne doivent pas être assimilées aux métriques ordinaires : elles requièrent le scope monétaire et un accès de monétisation adéquat. Un compte de chaîne standard peut interroger ses propres rapports d’activité, mais les rapports de content owner agrégés sont réservés aux partenaires de contenu YouTube et aux chaînes liées au content owner.

### YouTube Reporting API

La Reporting API est une alternative de **bulk reporting**, non un remplacement direct de `reports.query`. Elle exige de découvrir un type de rapport avec `reportTypes.list`, créer un job avec `jobs.create`, attendre la génération asynchrone, puis lister et télécharger les rapports avec `jobs.reports.list` et l’URL de téléchargement. Le premier rapport peut n’être disponible qu’à partir de 48 heures après la création du job et les rapports sont des fenêtres quotidiennes.

Elle est pertinente pour une ingestion historique ou volumique, notamment les rapports prédéfinis de chaîne, mais elle est plus lourde qu’une requête Analytics ciblée pour alimenter un tableau de bord TrafficFlow. Les rapports système de revenu réel sont réservés aux content owners ayant l’accès correspondant dans YouTube Studio.

## OAuth, scopes et conditions de compte

### Scopes à demander

Pour le périmètre actuel :

- `https://www.googleapis.com/auth/youtube.readonly` : lire le compte YouTube et les informations privées autorisées ; ce scope est aussi celui désormais requis par `reports.query` selon la documentation actuelle.
- `https://www.googleapis.com/auth/youtube.upload` : gérer les vidéos de l’utilisateur, notamment `videos.insert`. Ce scope limité suffit pour l’upload mais ne suffit pas à lui seul pour Analytics.
- `https://www.googleapis.com/auth/yt-analytics.readonly` : lire les rapports Analytics d’activité de la chaîne.
- `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` : nécessaire pour les métriques estimées de revenu et de performance publicitaire ; à ne demander que si TrafficFlow offre réellement cette fonctionnalité.
- `https://www.googleapis.com/auth/youtube` ou `https://www.googleapis.com/auth/youtubepartner` : gestion des groupes Analytics et cas content owner correspondants ; non nécessaire pour une simple lecture de rapports de chaîne.

Les scopes doivent rester minimaux. Le scope `youtube.upload` et le scope `youtube.readonly` présents dans TrafficFlow ne remplacent pas `yt-analytics.readonly`. La documentation `reports.query` mentionne aussi `youtube.readonly` comme exigence actuelle de la méthode ; pour assurer la compatibilité avec la méthode telle que documentée en 2026, il faut conserver/obtenir `youtube.readonly` **et** ajouter `yt-analytics.readonly` pour les rapports Analytics.

### Compte, projet et vérification

Le projet Google Cloud doit activer au minimum YouTube Data API v3 et l’API YouTube Analytics correspondante dans la console. Une application web serveur doit utiliser un OAuth client de type Web, un `redirect_uri` déclaré exactement et `access_type=offline` afin d’obtenir un refresh token durable.

L’accès Analytics est limité aux données que possède ou administre l’identité autorisée. Les requêtes de chaîne utilisent `channel==MINE` ou l’identifiant de la chaîne de l’utilisateur. Les rapports content owner exigent un content owner partenaire et des chaînes liées. Il ne faut donc pas promettre dans TrafficFlow une agrégation multi-chaînes générale à partir d’une simple connexion de chaîne.

Les scopes demandant accès à des données utilisateur peuvent déclencher la vérification OAuth Google. Google exige notamment une homepage sur un domaine vérifié, une politique de confidentialité accessible et cohérente avec l’écran de consentement, une description claire de l’usage des données, et, pour les scopes sensibles ou restreints, les éléments additionnels de vérification et une vidéo de démonstration du parcours OAuth. Les données Google obtenues doivent rester dans les usages limités et user-facing autorisés par la politique Google API Services User Data Policy.

## Quotas, latence et contraintes importantes

### Data API

- Le quota Data API est attribué au projet Google Cloud. La documentation indique une allocation par défaut de 10 000 unités par jour pour les autres endpoints, avec des limites documentées séparément pour `search.list` et `videos.insert` ; les valeurs et buckets peuvent évoluer, donc TrafficFlow doit surveiller la console plutôt que coder un chiffre immuable.
- Une lecture de ressource coûte généralement 1 unité ; une écriture coûte généralement 50 unités ; `search.list` est coûteux relativement à une lecture simple ; la page `videos.insert` indique actuellement un coût de 1 unité dans le bucket Video Uploads et une limite de 100 appels/jour pour cette méthode.
- Les requêtes invalides consomment aussi au moins une unité. Utiliser `part` et `fields`, éviter `search.list` lorsqu’un ID est connu, et mettre en cache les métadonnées avec une stratégie de rafraîchissement.
- L’upload multipart déjà utilisé est fonctionnel, mais un upload resumable est préférable pour les gros fichiers et les reprises réseau. Le serveur doit gérer les erreurs `uploadLimitExceeded`, `forbiddenPrivacySetting`, les titres/descriptions invalides et les erreurs de traitement asynchrones.

### Analytics

- Chaque requête Analytics compte comme une unité de quota Analytics ; les limites sont visibles séparément dans la console Google Cloud pour `youtubeanalytics.googleapis.com`.
- La latence de traitement est typiquement de 48 à 72 heures. Le `endDate` effectif s’arrête au dernier jour où **toutes** les métriques demandées sont disponibles. Les nombres peuvent donc différer de YouTube Studio en temps réel.
- Les données à faible trafic peuvent être anonymisées ou supprimées des ventilations. Cela affecte notamment démographie, géographie et certaines sources de trafic ; les seuils exacts ne sont pas publiés et peuvent changer.
- Les ventilations par éléments supprimés peuvent disparaître, alors que les agrégats globaux peuvent encore inclure leur activité historique. TrafficFlow doit afficher cette nuance dans les comparaisons total/par vidéo.
- Les réponses Analytics comportent une ligne d’en-têtes : le backend doit mapper les colonnes par leur nom et non par une position supposée.
- Les métadonnées récupérées via Data API doivent être supprimées ou rafraîchies après 30 jours selon les politiques YouTube citées par la documentation Analytics.

## Comparaison avec le code TrafficFlow

### Ce qui est déjà couvert

- `social-oauth.ts` configure Google OAuth avec `https://accounts.google.com/o/oauth2/v2/auth` et `https://oauth2.googleapis.com/token`.
- Le flux demande `access_type=offline`, stocke le refresh token chiffré et utilise le header `Authorization: Bearer` pour les appels API.
- La configuration demande `openid`, `https://www.googleapis.com/auth/youtube.readonly` et `https://www.googleapis.com/auth/youtube.upload`.
- L’identité utilise `channels.list` avec `mine=true`, ce qui est conforme au besoin de découvrir la chaîne authentifiée.
- `social-publishers.ts` publie une vidéo via `POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart`, en transmettant le titre, la description combinée et `privacyStatus=private`.
- Le publisher refuse correctement les posts texte/image seuls pour YouTube, puisque l’endpoint utilisé est l’upload vidéo Data API.

### Écarts et risques

1. **Analytics non autorisée :** le tableau `YouTube.scopes` ne contient pas `https://www.googleapis.com/auth/yt-analytics.readonly`. Une connexion existante ayant été consentie avec seulement les scopes actuels ne pourra pas appeler les rapports Analytics sans réautorisation/consentement incrémental.
2. **Aucun endpoint Analytics :** aucun appel serveur à `https://youtubeanalytics.googleapis.com/v2/reports` ni parseur de réponse `columnHeaders`/`rows` n’existe dans les fichiers inspectés.
3. **Pas de reporting bulk :** aucun job `reportTypes.list`/`jobs.create`/`jobs.reports.list` de YouTube Reporting API n’est implémenté. Ce n’est pas un défaut pour un dashboard ciblé, mais c’est une limite fonctionnelle à expliciter.
4. **Refresh token non consommé par le publisher :** `getSocialCredentials` retourne le refresh token mais ne renouvelle pas l’access token arrivé à expiration. Le callback stocke `expiresAt`, sans middleware de refresh observé dans ces fichiers. Les traitements planifiés finiront donc par échouer après expiration du token jusqu’à reconnexion ou ajout d’un refresh serveur.
5. **Publication toujours privée :** le publisher force `privacyStatus: "private"`. C’est cohérent pour un brouillon de validation, mais ne permet pas une publication publique/non répertoriée ou une planification sans extension du modèle de post et validation des contraintes YouTube.
6. **Upload non resumable :** le multipart est accepté, mais le téléchargement complet de `mediaUrl` en mémoire puis l’envoi multipart n’offre ni reprise ni contrôle explicite de taille. Pour de gros fichiers, l’upload resumable documenté est plus robuste.
7. **Pas de synchronisation des statistiques :** `PublishResult` ne conserve que l’ID de la vidéo et la réponse brute. Il n’existe pas, dans les fichiers inspectés, de tâche qui récupère `videos.list` pour les compteurs courants, ou `reports.query` pour l’historique Analytics.
8. **Risque de réautorisation et de politique :** l’ajout du scope Analytics, surtout du scope monétaire, doit être reflété dans le consentement, la privacy policy, la documentation produit et le dossier de vérification Google. Il ne faut pas ajouter le scope monétaire par défaut.

## Endpoints serveur recommandés et réellement utilisables

Pour le minimum viable Analytics de TrafficFlow, le serveur peut appeler directement :

```text
GET https://youtubeanalytics.googleapis.com/v2/reports
Authorization: Bearer <access_token>
```

Paramètres minimum : `ids`, `startDate`, `endDate`, `metrics`. Ajouter `dimensions` et `filters` uniquement selon une combinaison validée par les rapports de chaîne. Utiliser `ids=channel==MINE` pour éviter de faire confiance à un channel ID fourni côté client.

Pour les compteurs quasi courants d’une vidéo publiée :

```text
GET https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=<VIDEO_ID>
Authorization: Bearer <access_token>
```

Pour l’upload robuste :

```text
POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable
Authorization: Bearer <access_token>
```

Pour une future ingestion bulk, utiliser l’API Reporting séparée et son cycle `reportTypes.list` → `jobs.create` → `jobs.reports.list` → téléchargement du rapport. Elle ne doit pas être présentée comme une réponse instantanée.

## Sources officielles

[1]: https://developers.google.com/youtube/data/guides/authentication "YouTube Data API — Implement authorization"
[2]: https://developers.google.com/youtube/data/getting-started "YouTube Data API — Overview, quota usage and resources"
[3]: https://developers.google.com/youtube/data/reference/rest/v3/videos/insert "YouTube Data API — videos.insert"
[4]: https://developers.google.com/youtube/analytics "YouTube Analytics and Reporting APIs — overview"
[5]: https://developers.google.com/youtube/analytics/reference/reports/query "YouTube Analytics API — reports.query"
[6]: https://developers.google.com/youtube/analytics/reference "YouTube Analytics API — API reference and authorization"
[7]: https://developers.google.com/youtube/analytics/data_model "YouTube Analytics API — data model, latency, anonymization and quota"
[8]: https://developers.google.com/youtube/analytics/channel_reports "YouTube Analytics API — channel reports"
[9]: https://developers.google.com/youtube/reporting/v1/reports "YouTube Reporting API — bulk reports"
[10]: https://support.google.com/cloud/answer/9110914 "Google Cloud — OAuth App Verification Help"
[11]: https://support.google.com/cloud/answer/13464321 "Google Cloud — OAuth verification requirements"
[12]: https://developers.google.com/youtube/terms/developer-policies "YouTube API Services — Developer Policies"
