# Audit Facebook Pages Graph API pour TrafficFlow

**Date de vérification : 16 novembre 2026**  
**Périmètre :** Facebook Pages Graph API côté serveur, publication et analytics/Insights, permissions, tokens, quotas, conditions de compte et comparaison avec les fichiers TrafficFlow existants.

## Conclusion opérationnelle

La Facebook Pages API permet actuellement à un serveur de TrafficFlow de récupérer des informations de Page, publier du texte, des photos et des vidéos, lire les Insights d’une Page ou d’un post, gérer les commentaires et recevoir des mises à jour via Webhooks. La documentation officielle actuelle décrit l’endpoint d’analytics `GET /{page-id}/insights?metric=...`; il exige un **Page access token** obtenu pour une personne ayant la tâche Page `ANALYZE`, ainsi que `read_insights` et `pages_read_engagement` [1].

L’intégration TrafficFlow est partiellement prête pour la publication, mais pas pour Analytics. `social-oauth.ts` demande actuellement `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`, puis appelle `/me/accounts?fields=id,name,access_token,tasks` pour sélectionner une Page ayant `CREATE_CONTENT`. Aucun scope `read_insights` n’est demandé, aucune sélection/validation de `ANALYZE` n’est faite et aucun appel `/insights` n’existe dans `social-publishers.ts`. En l’état, la connexion Facebook peut donc suffire à publier, mais elle ne constitue pas une intégration Insights utilisable et fiable.

## Capacités officiellement documentées

La page de référence Pages API décrit comme capacités principales la gestion de Pages, la publication, la lecture des Insights, la modération des commentaires et les mises à jour en temps réel [1]. Les endpoints serveur directement pertinents sont les suivants :

- **Lister les Pages et obtenir les tokens Page :** `GET https://graph.facebook.com/{user-id}/accounts?access_token={user-access-token}`. La réponse comprend l’identifiant, le nom, le Page access token et les tâches disponibles, notamment `ANALYZE` et `CREATE_CONTENT` [2].
- **Lire les informations de Page :** `GET /{page-id}?fields=id,name,about,fan_count` dans l’exemple de la documentation Pages API [1]. Les champs effectivement disponibles peuvent varier selon la version et les permissions ; il faut traiter les champs facultatifs comme tels.
- **Publier un statut ou un lien :** `POST /{page-id}/feed`, avec notamment `message`, `link`, `picture` et `published`. La permission documentée pour la publication est `pages_manage_posts` [1].
- **Publier une photo :** l’intégration actuelle utilise `POST /{page-id}/photos` avec une URL publique (`url`), une légende (`caption`) et `published=true`. Ce flux est cohérent avec l’usage serveur de la Pages API, sous réserve du Page token et des droits de publication.
- **Publier une vidéo :** l’intégration actuelle utilise `POST https://graph-video.facebook.com/v27.0/{page-id}/videos` avec `file_url` et `description`. Le serveur doit fournir une URL média accessible à Meta et gérer les erreurs ou traitements asynchrones éventuels.
- **Lire les commentaires et modérer :** `GET /{object-id}/comments`, `POST /{object-id}/comments` et `DELETE /{comment-id}` sont documentés avec `pages_manage_engagement` [1]. TrafficFlow ne couvre pas ces opérations dans le publisher audité.
- **Lire les Insights Page ou post :** `GET /{object-id}/insights/{metric}` pour une métrique ou `GET /{object-id}/insights?metric=metric1,metric2,...` pour plusieurs métriques [3]. L’objet peut être la Page ou un post selon la métrique demandée.
- **Webhooks :** la documentation Pages API prévoit des notifications serveur pour les événements de Page, notamment le fil, les mentions, messages et changements de contenu [1]. Rien dans les deux fichiers audités n’implémente ces Webhooks.

## Analytics / Insights actuellement disponibles

L’endpoint Page Insights est supporté pour la **New Page Experience** [3]. Les familles de métriques actuellement listées comprennent notamment :

- engagement Page, par exemple `page_post_engagements`, `page_daily_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique` et `page_follows` ;
- consommation et vues média, dont `page_media_view` et `page_total_media_view_unique`, avec certains breakdowns comme `is_from_ads` et `is_from_followers` ;
- vues de Page et actions, dont `page_views_total` et `page_total_actions` ;
- métriques de posts et d’engagement post, comme `post_clicks`, `post_reactions_*`, `post_media_view` et `post_total_media_view_unique` ;
- vues vidéo Page et post, temps de visionnage et complétion, sous réserve des conditions spécifiques de création ou de republication de la vidéo [3].

Il faut impérativement envoyer le paramètre `metric`. Sans métrique, Meta documente une erreur code `3001`, sous-code `1504028` [3]. Une requête multi-métriques peut expirer ou ne pas retourner toutes les métriques ; Meta recommande alors de réduire le nombre de métriques par requête [3].

Les données ne sont pas un flux temps réel uniforme : la plupart des métriques sont mises à jour environ toutes les 24 heures. L’historique disponible est limité aux deux dernières années ; avec `since` et `until`, une fenêtre maximale de 90 jours peut être consultée à la fois [3]. Les métriques démographiques ne sont retournées que si elles disposent de données pour au moins 100 personnes. Les métriques uniques sont approximatives et certaines métriques vidéo peuvent retourner zéro ou être inexactes pour des vidéos repartagées par une autre Page [3]. Les interactions sur Reels ne sont pas incluses dans cet endpoint Page Insights [3].

### Dépréciations qui affectent un produit Analytics

La documentation de dépréciation avertit que l’appel d’une métrique retirée retourne une erreur `invalid metric` pour toutes les versions API [4]. Les vagues récentes sont particulièrement importantes pour TrafficFlow :

- depuis le 15 juin 2025, plusieurs métriques historiques d’impressions et de portée Page/post ont été supprimées ; les alternatives incluent `page_total_media_view_unique` et `post_total_media_view_unique` [4] ;
- depuis le 15 novembre 2025, `page_fans`, plusieurs variantes `page_impressions*` et `post_impressions*` ont été supprimées ou remplacées, notamment par `page_follows`, `page_media_view`, `post_media_view` et des breakdowns `is_from_ads` / `is_from_followers` [4] ;
- plusieurs métriques démographiques, de clics, de référents, d’activité et de sentiment ont déjà été retirées en 2024 [4].

TrafficFlow ne doit donc pas coder un catalogue d’anciens noms comme `page_fans`, `page_impressions` ou `post_impressions` sans migration conditionnelle. Il faut maintenir une liste de métriques validées pour la version courante et gérer explicitement l’erreur `invalid metric`.

## Permissions, tâches Page et conditions de compte

Pour publier, la documentation Pages API associe `pages_manage_posts` à la création et à la planification de contenu [1]. Pour lire le contenu et les engagements de la Page, elle documente `pages_read_engagement` [1]. La liste de Pages utilise `pages_show_list` [1]. Pour Insights, la référence précise les exigences suivantes :

- un **Page access token** ;
- un utilisateur qui possède la tâche Page **`ANALYZE`** ;
- les permissions **`read_insights`** et **`pages_read_engagement`** [3].

Un Page access token n’est pas obtenu directement par un simple client secret : Meta documente le flux user token puis appel de `/accounts` pour recevoir le token associé à chaque Page [2]. Les tokens Page sont propres à la combinaison Page, administrateur et application [2]. La documentation précise également que les system-user tokens peuvent automatiser des actions sur des Pages sans intervention ou réauthentification d’un utilisateur, mais que l’identité doit encore avoir accès à l’asset demandé [2].

Les permissions de gestion Page étendues nécessitent généralement une **App Review** avant un déploiement auprès d’utilisateurs qui ne sont pas des rôles de développement de l’application. La page Pages API demande de soumettre les permissions nécessaires, un cas d’usage détaillé et des éléments de démonstration, puis de publier l’application après validation [1]. Les conditions exactes dépendent du produit Meta et du mode d’accès configuré ; il ne faut pas assimiler un test avec un rôle administrateur/développeur à une autorisation de production générale.

Les tokens courts et longs ont des durées variables. Meta indique typiquement environ une à deux heures pour un token court et environ 60 jours pour un token long, tout en avertissant de ne pas dépendre de ces durées car elles peuvent changer ou expirer plus tôt [2]. Le code TrafficFlow conserve une expiration seulement si `expires_in` est renvoyé, mais ne met pas en place un renouvellement/reconnexion Facebook spécifique.

## Quotas et contraintes de débit

Meta indique que toutes les requêtes sont soumises à des limites. Pour Pages API, le régime dépend du token : les tokens application ou utilisateur relèvent des **Platform Rate Limits**, tandis que les Page access tokens et system-user tokens relèvent des **Business Use Case (BUC) Rate Limits** [5]. Si plusieurs régimes peuvent s’appliquer, Meta applique le régime BUC [5].

Les réponses peuvent exposer des statistiques d’utilisation dans des en-têtes, dont `X-App-Usage` pour le régime plateforme, avec `call_count`, `total_cputime` et `total_time` [5]. Une fois la limite atteinte, les appels suivants échouent jusqu’à la baisse du compteur. Les erreurs de limitation documentées incluent notamment le code `32` pour une limite Page, ainsi que d’autres codes de throttling selon le type de token [5].

Le serveur TrafficFlow doit donc : limiter les appels Insights périodiques, répartir les requêtes, réduire les fenêtres et le nombre de métriques en cas de requête complexe, lire les en-têtes d’usage quand présents, journaliser le code Meta et respecter `Retry-After` s’il est fourni. Il ne faut pas prétendre à un nombre fixe universel d’appels par Page : le quota BUC dépend du cas d’usage et du contexte de l’application, contrairement à la formule plateforme documentée pour les app tokens (`200 * nombre d’utilisateurs` par fenêtre glissante d’une heure) [5].

## Comparaison au code TrafficFlow

### `server/integrations/social-oauth.ts`

Le code définit `API_VERSION` par `SOCIAL_API_VERSION`, avec `v27.0` par défaut, ce qui correspond à la version affichée par la référence Page Insights consultée [3]. La configuration Facebook utilise bien les endpoints OAuth Graph versionnés et les scopes `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`.

Le callback appelle `/{user}/accounts?fields=id,name,access_token,tasks`, puis sélectionne une Page ayant `CREATE_CONTENT`. C’est adapté à l’objectif publication, mais insuffisant pour Analytics : il faut demander `read_insights`, vérifier que `tasks` contient `ANALYZE`, et sélectionner ou refuser explicitement les Pages sans cette tâche. Si l’utilisateur gère plusieurs Pages, le choix automatique `CREATE_CONTENT` puis première Page peut rattacher le mauvais asset à TrafficFlow.

Le code stocke le token Page (`account.accessToken`) plutôt que le user token, ce qui est correct pour les appels Page côté serveur. En revanche, il ne conserve pas les tâches de Page ni un état de validation des permissions. Le champ `oauth_scopes` est alimenté par `exchanged.body.scope` ou `scopes`; il faut vérifier que le format de réponse Facebook contient effectivement la valeur attendue et ne pas considérer ce champ comme preuve suffisante des tâches Page. Les tokens sont chiffrés côté serveur, ce qui est une bonne pratique, mais le secret de secours `trafficflow-state-secret-change-me` est dangereux s’il est utilisé en production : un secret obligatoire et unique doit être imposé.

### `server/integrations/social-publishers.ts`

`publishFacebook` implémente trois branches côté serveur : `/feed` pour le texte, `graph-video.../{page-id}/videos` pour la vidéo avec `file_url`, et `/{page-id}/photos` pour l’image avec `url`. Ces branches correspondent aux capacités de publication documentées, et l’usage d’un token Page chiffré/déchiffré côté serveur est cohérent.

Il manque entièrement une fonction de lecture Analytics, par exemple un appel GET à `https://graph.facebook.com/${API_VERSION}/${pageId}/insights` avec `metric`, `since`, `until`, `period` et éventuellement `breakdown`. Il manque aussi la normalisation des résultats, la pagination éventuelle, la gestion d’un historique limité à 90 jours, la détection des métriques dépréciées et la lecture des en-têtes de quota. Le type `PublishResult` ne prévoit que l’identifiant et l’URL d’un contenu publié ; il ne peut pas représenter des séries temporelles d’Insights.

Le code ne vérifie pas que `provider_account_id` est réellement un Page ID doté d’`ANALYZE` ou `CREATE_CONTENT`. Une reconnexion, la suppression d’une permission, le changement de rôle, l’expiration ou la révocation d’un token peuvent rendre le compte invalide après l’enregistrement. Les erreurs Meta sont remontées comme `provider_<status>:<json>`, mais sans classification spécifique des codes OAuth, permission, invalid metric et rate limit.

## Écarts TrafficFlow prioritaires

1. **Analytics absent :** aucun endpoint `/insights` et aucune structure de stockage/synchronisation pour les séries Page ou post.
2. **Scope manquant :** ajouter la demande et la vérification de `read_insights`; `pages_read_engagement` est déjà présent mais ne remplace pas `read_insights`.
3. **Tâche Page non vérifiée :** la sélection doit exiger `ANALYZE` pour Analytics et `CREATE_CONTENT` pour la publication, au lieu de choisir uniquement `CREATE_CONTENT`.
4. **Catalogue métrique obsolète à éviter :** utiliser les métriques actuelles (`page_media_view`, `page_total_media_view_unique`, `page_follows`, `post_media_view`, `post_total_media_view_unique`, etc.) et traiter `invalid metric`.
5. **Fenêtres et fraîcheur :** planifier une collecte compatible avec une mise à jour souvent quotidienne, ne jamais demander plus de 90 jours d’un coup et conserver une stratégie de backfill par fenêtres.
6. **Quotas non instrumentés :** capturer `X-App-Usage`/indicateurs BUC quand présents, appliquer backoff et éviter les fan-outs de métriques volumineux.
7. **App Review et production :** documenter le cas d’usage Insights et publication, préparer une démonstration et vérifier l’accès avancé/requis dans le tableau de bord Meta avant de promettre la connexion à tous les clients.
8. **Cycle de vie token :** gérer expiration, réautorisation et révocation ; ne pas supposer une durée fixe.
9. **Sélection de Page :** exposer à l’utilisateur la liste `/accounts` et la Page choisie, plutôt que retenir silencieusement la première Page compatible.
10. **Webhooks non couverts :** si TrafficFlow veut des commentaires, mentions ou changements quasi temps réel, ajouter l’abonnement et le callback Webhooks ; Insights lui-même reste principalement une donnée agrégée à rafraîchissement différé.

## Endpoints côté serveur réellement utilisables

Pour un serveur TrafficFlow correctement autorisé, le minimum réaliste est :

```text
GET  https://graph.facebook.com/v27.0/{user-id}/accounts
     ?fields=id,name,access_token,tasks
     &access_token={user-access-token}

POST https://graph.facebook.com/v27.0/{page-id}/feed
     Authorization/ access_token = {page-access-token}
     message=...

POST https://graph.facebook.com/v27.0/{page-id}/photos
     access_token={page-access-token}&url={public-image-url}&caption=...

POST https://graph-video.facebook.com/v27.0/{page-id}/videos
     access_token={page-access-token}&file_url={public-video-url}&description=...

GET  https://graph.facebook.com/v27.0/{page-id}/insights
     ?metric=page_post_engagements,page_media_view,page_follows
     &since=YYYY-MM-DD&until=YYYY-MM-DD
     &access_token={page-access-token}

GET  https://graph.facebook.com/v27.0/{post-id}/insights
     ?metric=post_media_view,post_reactions_by_type_total
     &access_token={page-access-token}
```

Les exemples ci-dessus sont des formes d’endpoint documentées et doivent être testés avec les métriques autorisées par la version active ; ils ne constituent pas une garantie que chaque métrique historique reste disponible. Les secrets et tokens ne doivent rester que côté serveur, via HTTPS.

## Verdict

**Publication : partiellement conforme et plausible**, sous réserve de l’App Review, des droits Page et de la validité des flux média. **Analytics : non implémenté et non autorisable de manière fiable en l’état**, principalement à cause de l’absence de `read_insights`, de l’absence de contrôle `ANALYZE`, de l’absence d’appel `/insights` et de l’absence de gestion des dépréciations/quotas. La priorité est de séparer explicitement la connexion publication de la connexion Analytics, de faire sélectionner une Page par l’utilisateur, puis de construire une collecte Insights versionnée avec métriques actuelles, fenêtres de 90 jours maximum, cache et backoff.

## References

[1]: https://developers.facebook.com/documentation/pages-api "Facebook Pages API — Meta for Developers"
[2]: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens "Access Tokens for Meta Technologies — Meta for Developers"
[3]: https://developers.facebook.com/docs/graph-api/reference/page/insights/ "Graph API Reference v27.0: Page Insights — Meta for Developers"
[4]: https://developers.facebook.com/documentation/pages-api/platforminsights/page/deprecated-metrics "Deprecated Facebook Page Insights Metrics — Meta for Developers"
[5]: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ "Rate Limits — Graph API — Meta for Developers"
