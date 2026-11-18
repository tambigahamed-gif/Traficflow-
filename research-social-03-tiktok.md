# Audit TikTok Content Posting API et Display API pour TrafficFlow

## Conclusion opérationnelle

La plateforme TikTok actuellement documentée permet à TrafficFlow de connecter un compte, de publier directement des vidéos et des photos, de consulter le profil autorisé et de lister/interroger les vidéos publiques de cet utilisateur. Elle ne fournit toutefois pas, via les seules Content Posting et Display APIs, une suite complète d’analytics comparable à des insights natifs : l’API expose des compteurs publics par vidéo (`like_count`, `comment_count`, `share_count`, `view_count`) et des compteurs de profil (`follower_count`, `following_count`, `likes_count`, `video_count`), mais pas d’impressions, portée, watch time, rétention, audience démographique, clics ou séries temporelles documentées. [1] [2] [3]

Le code TrafficFlow possède une base OAuth et un chemin de publication TikTok, mais il est incomplet pour une intégration conforme et exploitable en production. Les deux lacunes les plus bloquantes sont l’absence du scope `video.list` (donc pas d’accès Display ni aux compteurs vidéo) et l’absence de la séquence obligatoire `creator_info/query` puis récupération de statut. La publication actuelle force aussi `SELF_ONLY`, ne recueille pas les choix de confidentialité/interactions exigés par TikTok et considère le retour `publish_id` comme un succès final.

## Capacités réellement documentées

### Content Posting API

- **Query Creator Info** : `POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/`. Cette étape doit précéder l’affichage de l’écran de publication. Elle fournit notamment le pseudo, les niveaux de confidentialité réellement disponibles, les états comment/duet/stitch et la durée vidéo maximale du créateur. [4]
- **Initialisation vidéo Direct Post** : `POST https://open.tiktokapis.com/v2/post/publish/video/init/`, scope `video.publish`. La source peut être `PULL_FROM_URL` ou `FILE_UPLOAD`; la réponse fournit un `publish_id` et, pour l’upload, une `upload_url`. L’URL d’upload expire après une heure. [5]
- **Initialisation photo** : `POST https://open.tiktokapis.com/v2/post/publish/content/init/`, scope `video.publish` pour Direct Post ou `video.upload` pour le mode `MEDIA_UPLOAD`. Le mode photo accepte jusqu’à 35 URLs publiques et vérifiées, avec `photo_cover_index`; le titre est limité à 90 runes UTF-16 et la description à 4 000. [6]
- **Transfert serveur** : pour `PULL_FROM_URL`, l’URL doit être HTTPS, sans redirection, publiquement accessible pendant le téléchargement et appartenir à un domaine ou préfixe d’URL vérifié dans l’application TikTok. [7]
- **Statut** : `POST https://open.tiktokapis.com/v2/post/publish/status/fetch/`, scope `video.upload` ou `video.publish`, ou webhooks Content Posting. Les statuts incluent `PROCESSING_DOWNLOAD`, `PUBLISH_COMPLETE` et `FAILED`; pour un post public, le `post_id` peut n’être fourni qu’après modération. [8]

Les restrictions média actuellement indiquées sont MP4/WebM/MOV avec codecs H.264/H.265/VP8/VP9, 23–60 FPS, dimensions 360–4096 pixels, taille vidéo maximale 4 Go; la durée dépend du compte, avec 3 minutes pour tous les créateurs et 5 ou 10 minutes pour certains, tandis que l’endpoint Upload Video accepte au plus 10 minutes. Les photos acceptées sont WebP/JPEG, jusqu’à 1080p et 20 Mo par image. [7]

### Display API et données assimilables à des analytics

Le Display API ne comporte que trois composants : `GET /v2/user/info/`, `POST /v2/video/list/` et `POST /v2/video/query/`. Le scope `video.list` lit les vidéos publiques de l’utilisateur autorisé; `user.info.basic` lit les champs de profil de base. [1]

- `POST https://open.tiktokapis.com/v2/video/list/` renvoie les vidéos publiques, triées par date de création décroissante. `max_count` vaut 10 par défaut et 20 au maximum; la pagination se fait avec un curseur en millisecondes UTC. [2]
- `POST https://open.tiktokapis.com/v2/video/query/` vérifie que les IDs appartiennent à l’utilisateur autorisé, rafraîchit notamment la durée de vie de l’URL de couverture, et accepte jusqu’à 20 IDs. Les champs documentés incluent `like_count`, `comment_count`, `share_count` et `view_count`, en plus des métadonnées. [3]
- `GET https://open.tiktokapis.com/v2/user/info/` peut demander `follower_count`, `following_count`, `likes_count` et `video_count` avec le scope `user.info.stats`; `username`, bio, profil et vérification nécessitent `user.info.profile`. [9]

Ces métriques sont des compteurs courants, sans endpoint documenté dans ces APIs pour obtenir l’évolution dans le temps, les impressions/portée, la durée de visionnage, la rétention, les sources de trafic, les données d’audience ou les conversions. Il faut donc présenter TikTok comme **métriques publiques de profil/vidéo disponibles**, et non comme **analytics TikTok natifs complets**. Les Research Tools ne constituent pas un substitut général pour les insights d’un compte créateur et ont une finalité/éligibilité distincte.

## Permissions, OAuth et contraintes de compte

Les scopes sont d’abord ajoutés et approuvés au niveau de l’application, puis chaque utilisateur doit les autoriser; l’approbation du scope seule ne donne pas accès aux données. [10]

Scopes pertinents pour TrafficFlow :

- `user.info.basic` : `open_id`, `union_id`, avatar et nom affiché.
- `user.info.profile` : pseudo, bio, lien profond de profil et statut vérifié.
- `user.info.stats` : abonnés, abonnements, likes cumulés et nombre de vidéos publiques.
- `video.list` : vidéos publiques de l’utilisateur et métadonnées/compteurs exposés par `video/query`.
- `video.publish` : Direct Post vidéo/photo.
- `video.upload` : transfert vers le flux de création TikTok (`MEDIA_UPLOAD`) et récupération de statut pour ce mode; ce n’est pas le même usage que Direct Post. [1] [6] [8]

Le token utilisateur s’obtient sur `POST https://open.tiktokapis.com/v2/oauth/token/` avec `client_key`, `client_secret`, `code`, `grant_type=authorization_code` et `redirect_uri` identique à celui de l’autorisation. L’access token est documenté comme valable 24 heures; le refresh token comme valable 365 jours et potentiellement renouvelé à chaque rafraîchissement, donc le nouveau refresh token doit remplacer l’ancien. Le même endpoint sert au `grant_type=refresh_token`; la révocation passe par `POST https://open.tiktokapis.com/v2/oauth/revoke/`. [11]

L’API applique des limites distinctes. Les valeurs par défaut publiées sont 600 requêtes par minute pour chacun de `/v2/user/info/`, `/v2/video/query/` et `/v2/video/list/`; un dépassement renvoie HTTP 429 `rate_limit_exceeded`. Le Direct Post vidéo et photo documente une limite de 6 requêtes par minute et par access token pour l’initialisation; le fetch de statut est limité à 30 requêtes par minute et par access token. [12] [5] [6] [8]

Les contraintes Content Posting sont importantes :

- Un client non audité ne peut publier que vers des comptes privés et les contenus sont en `SELF_ONLY`; les guidelines indiquent aussi un plafond de 5 utilisateurs sur une fenêtre de 24 heures pour un client non audité. L’audit est nécessaire pour lever cette restriction de visibilité. [4] [13]
- Les clients audités et non audités restent soumis à un plafond de créateurs actifs par client et à un plafond de publications par créateur sur 24 heures, typiquement autour de 15 posts/jour/créateur, partagé entre les clients Direct Post. [13]
- Le client doit récupérer les options de confidentialité à chaque affichage, ne doit pas choisir une confidentialité par défaut, et doit laisser l’utilisateur sélectionner explicitement confidentialité, commentaires, Duet et Stitch. Le mode photo n’affiche que le commentaire pour Duet/Stitch. [13]
- Le produit doit demander un consentement explicite avant l’envoi, afficher un aperçu, ne pas ajouter de logo/watermark promotionnel, permettre la modification du titre/hashtags, et informer que le traitement peut prendre quelques minutes. [13]
- Les paramètres de contenu commercial (`brand_content_toggle`, `brand_organic_toggle`) et les déclarations associées doivent être pris en charge si TrafficFlow publie du contenu commercial; le branded content ne peut pas être privé. [13]
- TikTok demande que les clients destinés à une large audience facilitent du contenu original de créateurs authentiques; un outil limité à la gestion des comptes de l’équipe ou à la copie arbitraire depuis d’autres plateformes est explicitement contraire à l’usage prévu. [13]

## Comparaison avec le code TrafficFlow existant

### Points déjà présents

`social-oauth.ts` contient un provider TikTok, utilise le client key/secret, pointe vers `https://www.tiktok.com/v2/auth/authorize/` et `https://open.tiktokapis.com/v2/oauth/token/`, demande `user.info.basic` et `video.publish`, échange le code avec les paramètres TikTok attendus, et stocke access/refresh tokens chiffrés. Le callback récupère `open_id` depuis la réponse OAuth. Le serveur est donc proche du minimum nécessaire pour une connexion et une première publication vidéo.

`social-publishers.ts` utilise bien les deux endpoints d’initialisation officiels : `/v2/post/publish/video/init/` pour les vidéos et `/v2/post/publish/content/init/` pour les photos. Il emploie `PULL_FROM_URL`, ce qui est adapté à un média déjà stocké côté serveur **à condition** que le domaine ou préfixe soit vérifié et que l’URL respecte les contraintes TikTok.

### Écarts bloquants ou importants

1. **Display/insights non implémentés.** Les scopes demandés sont seulement `user.info.basic` et `video.publish`. Il manque au minimum `video.list`; il manque aussi `user.info.profile` et `user.info.stats` si TrafficFlow veut afficher pseudo/statistiques de profil. Aucun appel à `/v2/user/info/`, `/v2/video/list/` ou `/v2/video/query/` n’existe.
2. **Pas de `creator_info/query` avant publication.** Le publisher appelle directement l’init vidéo/photo. Cela empêche de connaître les options de confidentialité et la durée maximale du créateur et ne satisfait pas les guidelines UX/API.
3. **Confidentialité incorrectement codée.** La vidéo force `privacy_level: "SELF_ONLY"`; la photo n’envoie même pas `privacy_level`, alors qu’il est requis pour Direct Post. Il faut utiliser une valeur choisie par l’utilisateur parmi celles retournées par `creator_info/query`, sans valeur par défaut. Le comportement actuel restera privé pour un client non audité, mais ne permet pas une intégration auditée conforme.
4. **Paramètres d’interaction et commerciaux absents.** Le code ne transmet ni `disable_comment`, `disable_duet`, `disable_stitch`, ni les toggles de contenu commercial; il ne peut donc pas refléter les préférences et contraintes renvoyées par TikTok.
5. **Faux succès de publication.** `publishTikTok` retourne immédiatement `publish_id` après l’init et ne récupère jamais `/v2/post/publish/status/fetch/`. Il faut persister le publish ID, traiter `PROCESSING_*`, `PUBLISH_COMPLETE` et `FAILED`, et idéalement brancher les webhooks. Le `publish_id` n’est pas le `post_id` final.
6. **OAuth sans renouvellement serveur.** Le code stocke un refresh token et une date d’expiration de l’access token, mais `getSocialCredentials` ne rafraîchit pas le token expiré et aucun job de refresh n’est visible dans les fichiers inspectés. Avec une durée de vie de 24 h, les publications et lectures récurrentes finiront par échouer.
7. **Identité trop pauvre pour le produit.** `identity` utilise `open_id` comme handle et n’appelle pas `/v2/user/info/`; TrafficFlow ne récupère donc ni `username`, ni `display_name`, ni profil/statistiques réelles.
8. **URL média à vérifier.** Le code suppose qu’une URL publique suffit. TikTok exige un domaine/préfixe vérifié, HTTPS sans redirection, et une disponibilité pendant le téléchargement. Cette précondition doit être configurée et contrôlée au niveau de TrafficFlow.
9. **Pas de validation média/compte avant envoi.** Le code ne vérifie pas la durée contre `max_video_post_duration_sec`, les options de confidentialité, les dimensions, FPS, taille ou format, et ne traite pas les erreurs métier comme `reached_active_user_cap`, `spam_risk_too_many_posts`, `privacy_level_option_mismatch` ou `url_ownership_unverified` autrement qu’en remontant une erreur HTTP générique.
10. **Photo incomplète.** Le payload actuel met tout le texte dans `post_info.title`, ne distingue pas titre et description et n’expose ni consentement, ni commentaire, ni divulgation commerciale. Il envoie une seule image, ce qui est valide, mais doit respecter le schéma photo actuel et les limites d’image.

## Endpoints serveur réellement utilisables par TrafficFlow

Les endpoints HTTP utilisables depuis le backend, avec un access token utilisateur TikTok, sont :

- OAuth : `POST /v2/oauth/token/` pour code ou refresh; `POST /v2/oauth/revoke/` pour déconnexion.
- Profil : `GET /v2/user/info/?fields=...`.
- Display : `POST /v2/video/list/?fields=...` et `POST /v2/video/query/?fields=...`.
- Publication : `POST /v2/post/publish/creator_info/query/`, `POST /v2/post/publish/video/init/`, `POST /v2/post/publish/content/init/`.
- Suivi : `POST /v2/post/publish/status/fetch/`; webhooks Content Posting si l’application est configurée.
- Média : upload binaire vers l’`upload_url` retournée par TikTok lorsque `FILE_UPLOAD` est utilisé, ou `PULL_FROM_URL` depuis un domaine vérifié.

Le secret client doit rester côté serveur. Un backend peut appeler ces endpoints; cela ne supprime ni l’obligation d’approbation des scopes, ni l’autorisation individuelle, ni l’audit Content Posting, ni les plafonds d’usage.

## Verdict TrafficFlow

**Publication vidéo : partiellement faisable dans l’état, mais non conforme et non fiable en production.** Le code appelle un endpoint valide et peut obtenir un `publish_id`, mais il doit d’abord interroger le créateur, respecter ses choix, gérer les restrictions du client/audit et attendre le statut final.

**Publication photo : endpoint correctement identifié, payload incomplet.** Le code doit fournir les champs Direct Post requis, notamment une confidentialité autorisée par TikTok, puis suivre le statut.

**Analytics/insights : non disponible dans l’intégration actuelle et seulement partiellement disponible dans les APIs TikTok auditées.** Pour TrafficFlow, le périmètre réaliste est l’affichage de statistiques publiques (profil et compteurs vidéo) avec `user.info.stats` et `video.list`, plus une collecte périodique côté TrafficFlow pour construire un historique. Il ne faut pas promettre les insights natifs détaillés sans une autre API ou une capacité TikTok explicitement approuvée et documentée.

## Références

[1]: https://developers.tiktok.com/doc/display-api-overview?enter_method=left_navigation "TikTok Display API Overview"
[2]: https://developers.tiktok.com/doc/tiktok-api-v2-video-list "TikTok List Videos API"
[3]: https://developers.tiktok.com/doc/tiktok-api-v2-video-query "TikTok Query Videos API"
[4]: https://developers.tiktok.com/doc/content-posting-api-get-started "TikTok Content Posting API Get Started"
[5]: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post "TikTok Content Posting API Direct Post"
[6]: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post "TikTok Content Posting API Photo Post"
[7]: https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide "TikTok Content Posting API Media Transfer Guide"
[8]: https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status "TikTok Content Posting API Get Post Status"
[9]: https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info "TikTok User Info API"
[10]: https://developers.tiktok.com/doc/scopes-overview "TikTok Scopes Overview"
[11]: https://developers.tiktok.com/doc/oauth-user-access-token-management "TikTok User Access Token Management"
[12]: https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit?enter_method=left_navigation "TikTok API v2 Rate Limits"
[13]: https://developers.tiktok.com/doc/content-sharing-guidelines "TikTok Content Sharing Guidelines"
