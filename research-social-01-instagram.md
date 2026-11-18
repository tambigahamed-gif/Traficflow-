# Audit Instagram Graph API pour TrafficFlow

**Date de vérification : 16 novembre 2026**  
**Périmètre :** Instagram Platform / Instagram Graph API, avec comparaison au code existant de TrafficFlow.  
**Fichiers inspectés sans modification :** `server/integrations/social-oauth.ts` et `server/integrations/social-publishers.ts`.

## Conclusion opérationnelle

TrafficFlow utilise actuellement l’API Instagram avec Instagram Login, via `https://www.instagram.com/oauth/authorize`, `https://api.instagram.com/oauth/access_token` et `https://graph.instagram.com/v24.0`. Ce choix est cohérent pour des comptes Instagram professionnels (Business ou Creator), sans Page Facebook liée. Meta documente maintenant les insights avec cette configuration, mais l’intégration TrafficFlow ne les exploite pas : elle ne demande que `instagram_business_basic` et `instagram_business_content_publish`, ne demande pas `instagram_business_manage_insights`, ne récupère pas de média, et ne déclenche aucun appel `/insights`.

La mise en conformité minimale pour l’analytics nécessite donc l’ajout de `instagram_business_manage_insights` au flux de consentement et la création d’une collecte serveur sur les deux endpoints documentés : `GET /<INSTAGRAM_ACCOUNT_ID>/insights` pour les métriques du compte et `GET /<INSTAGRAM_MEDIA_ID>/insights` pour les métriques de chaque média. L’application devra aussi gérer les tokens long-lived de 60 jours et leur renouvellement, car le code actuel conserve le token court issu de l’échange initial sans effectuer l’échange vers un token long-lived.

## Capacités Analytics / Insights actuellement documentées

### Insights de compte professionnel

L’endpoint réellement utilisable est :

```text
GET https://graph.instagram.com/v27.0/<INSTAGRAM_ACCOUNT_ID>/insights
  ?metric=<METRICS>
  &period=<PERIOD>
  &metric_type=<METRIC_TYPE>
  &breakdown=<BREAKDOWN>
  &since=<UNIX_TIMESTAMP>
  &until=<UNIX_TIMESTAMP>
  &access_token=<INSTAGRAM_USER_ACCESS_TOKEN>
```

Avec Instagram Login, l’hôte est `graph.instagram.com`, le jeton est un Instagram User access token, et la permission requise est `instagram_business_basic` plus `instagram_business_manage_insights` [1] [2]. Le compte cible est l’Instagram professional account ID de l’utilisateur connecté. La référence Meta indique que la dernière version documentée est `v27.0` [2].

Les métriques de compte actuellement listées comprennent notamment `accounts_engaged`, `comments`, `follows_and_unfollows`, `likes`, `profile_links_taps`, `reach`, `replies`, `reposts`, `saves`, `shares`, `total_interactions` et `views`. Les métriques démographiques comprennent `follower_demographics` et `engaged_audience_demographics`, avec des breakdowns par âge, ville, pays ou genre. Les métriques peuvent être agrégées comme série temporelle ou valeur totale, selon la métrique et les paramètres demandés [2].

Point important pour TrafficFlow : `impressions` est dépréciée à partir de v22.0 et pour toutes les versions depuis le 21 avril 2025. Le modèle d’analytics ne doit donc pas considérer `impressions` comme une métrique fiable pour les nouvelles collectes ; `views` est la métrique moderne documentée, encore signalée « in development » dans la référence Meta [2].

### Insights de média

L’endpoint réellement utilisable est :

```text
GET https://graph.instagram.com/v27.0/<INSTAGRAM_MEDIA_ID>/insights
  ?metric=<METRICS>
  &period=<PERIOD>
  &breakdown=<BREAKDOWN>
  &access_token=<INSTAGRAM_USER_ACCESS_TOKEN>
```

La documentation confirme que cet endpoint est disponible avec Instagram Login et requiert `instagram_business_basic` et `instagram_business_manage_insights` [3]. Les métriques dépendent du type de média : posts Feed, Reels et Stories exposent des sous-ensembles différents. La référence actuelle liste notamment `comments`, `likes`, `reach`, `replies`, `reposts`, `saved`, `shares`, `total_interactions`, `views`, ainsi que `profile_activity`, `profile_visits`, `link_clicks`, `navigation`, `follows`, `ig_reels_avg_watch_time` et d’autres métriques spécialisées [3].

Les agrégats `total_comments`, `total_likes` et `total_views`, qui incluent l’engagement de contenu promu ou publicitaire, sont réservés à l’API avec Facebook Login. Avec Instagram Login, TrafficFlow doit donc distinguer les métriques organiques du média des totaux cross-surface et ne pas promettre des totaux publicitaires [3].

Les données peuvent être retardées jusqu’à 48 heures. Les données d’insights de média sont conservées jusqu’à deux ans, mais les insights de Stories ne sont disponibles que pendant 24 heures, sauf cas lié à un Highlight. Les métriques Story inférieures à cinq viewers peuvent renvoyer une erreur plutôt qu’une valeur. Les webhooks d’insights ne sont pas supportés avec Instagram Login ; il faut donc prévoir une collecte planifiée côté serveur si TrafficFlow veut historiser les résultats [3].

### Lecture des médias nécessaire à l’analytics

Pour obtenir les IDs de médias à analyser, le serveur peut utiliser la lecture de l’objet IG Media et l’arête média du compte, avec `instagram_business_basic`. La référence IG Media confirme notamment la lecture de `id`, `caption`, `media_type`, `media_product_type`, `media_url`, `permalink`, `timestamp`, `username` et de compteurs publics selon le contexte [4]. L’intégration actuelle ne comporte aucune fonction de lecture de la liste des médias et ne sauvegarde pas d’ID de média Instagram après publication ; elle ne peut donc pas encore rattacher des insights par publication.

## Permissions, scopes et conditions de compte

### Scopes nécessaires avec Instagram Login

Pour le périmètre actuellement visible dans TrafficFlow :

- `instagram_business_basic` : lecture de base de l’identité et des objets Instagram professionnels ;
- `instagram_business_content_publish` : création de containers puis publication de contenu ;
- `instagram_business_manage_insights` : lecture des insights de compte et de média ;
- `instagram_business_manage_comments` : uniquement si TrafficFlow ajoute la modération des commentaires ;
- `instagram_business_manage_messages` : uniquement si TrafficFlow ajoute la messagerie.

Meta précise que les anciens scopes `business_basic`, `business_content_publish`, `business_manage_comments` et `business_manage_messages` ont été remplacés par les noms `instagram_business_*` et sont dépréciés depuis le 27 janvier 2025 [5]. Le code actuel utilise correctement les deux noms modernes qu’il demande, mais il manque le scope analytics.

L’URL d’autorisation accepte une liste séparée par virgules ou une liste séparée par espaces encodée ; le séparateur par virgules utilisé par TrafficFlow est donc compatible avec la documentation [6]. La permission effective doit toutefois être activée dans le tableau de bord Meta et effectivement accordée par l’utilisateur ; stocker la chaîne `scope` renvoyée par Meta est utile pour diagnostiquer les consentements incomplets.

### Conditions de compte et niveau d’accès

L’API vise uniquement les comptes Instagram professionnels, c’est-à-dire Business ou Creator. Un compte personnel n’est pas une cible valide pour ces endpoints [1] [2]. Instagram Login ne nécessite pas de Page Facebook liée, contrairement à l’ancienne configuration Facebook Login [1] [5].

Le Standard Access suffit lorsque l’application ne sert que les comptes que l’équipe possède ou gère et qui sont ajoutés dans le tableau de bord de l’application. Si TrafficFlow sert les comptes de clients qui ne sont pas des rôles de l’application, l’Advanced Access est requis ; Meta précise que l’Advanced Access est soumis à la vérification de l’entreprise et, selon la permission ou la fonctionnalité, à la revue de l’application [1] [7]. Les utilisateurs non autorisés dans l’application ne pourront donc pas être traités en production avec le seul accès Standard.

### Tokens et exécution serveur

Le code existant échange bien le code d’autorisation auprès de `api.instagram.com/oauth/access_token`, ce qui correspond à la première étape documentée. Meta demande ensuite d’échanger ce token court auprès de `GET https://graph.instagram.com/access_token` avec `grant_type=ig_exchange_token`, `client_secret` et `access_token`, afin d’obtenir un token long-lived valable 60 jours. Le renouvellement se fait auprès de `GET https://graph.instagram.com/refresh_access_token` avant expiration [6]. Ces appels doivent rester côté serveur car ils impliquent le secret de l’application.

Dans `social-oauth.ts`, `exchange()` conserve `body.access_token` directement et renseigne éventuellement `expires_in`, mais ne réalise ni échange long-lived ni rafraîchissement. Le résultat est donc fragile pour une plateforme de planification : après expiration du token court, les publications et futurs insights échoueront tant qu’une reconnexion n’est pas effectuée.

## Quotas et contraintes importantes

Meta applique aux requêtes Instagram Platform les Business Use Case rate limits. La plateforme indique que les réponses incluent, après un volume suffisant, des en-têtes d’usage tels que `X-App-Usage` ou des informations BUC ; les erreurs de limitation doivent être traitées et les appels répartis dans le temps [8]. Le code TrafficFlow ne lit pas ces en-têtes, ne met pas en place de backoff explicite et ne distingue pas les erreurs de quota des autres erreurs HTTP.

La publication est plafonnée par compte dans une fenêtre glissante de 24 heures. La page générale Content Publishing indique 100 publications API par compte et précise qu’un carrousel compte comme une publication [9]. Cependant, la référence dédiée `media_publish`, mise à jour plus récemment dans le résultat consulté, indique 50 publications par compte sur 24 heures [10]. Cette contradiction entre deux pages officielles doit être traitée comme un risque documentaire ; en attendant une clarification Meta, un scheduler TrafficFlow devrait appliquer la limite conservatrice de 50 et interroger `GET /<IG_ID>/content_publishing_limit` avant de saturer le quota.

Les médias utilisés pour la publication doivent être accessibles sur un serveur public au moment où Meta les récupère [9]. Le code existant transmet bien `image_url` ou `video_url` depuis `mediaUrl`, mais ne vérifie pas explicitement l’accessibilité, le format ou la durée avant l’appel. JPEG est le format image documenté comme supporté ; les shopping tags et filtres ne sont pas supportés avec ce parcours [9].

Le flux de publication est conceptuellement correct pour un média simple : `POST /<IG_ID>/media`, interrogation du container via `GET /<IG_CONTAINER_ID>?fields=status_code`, puis `POST /<IG_ID>/media_publish` avec `creation_id` [9] [10]. La référence rappelle que les containers et la publication sont des opérations serveur, qu’une réponse peut contenir un succès partiel (`config_issue`) et que l’ID de média retourné doit être conservé [10].

## Comparaison précise avec le code TrafficFlow

### Ce qui est aligné

- `social-oauth.ts` utilise l’URL d’autorisation officielle `https://www.instagram.com/oauth/authorize`.
- L’échange initial utilise `https://api.instagram.com/oauth/access_token`, conforme au Business Login for Instagram.
- Les scopes actuellement présents, `instagram_business_basic` et `instagram_business_content_publish`, sont les noms modernes documentés.
- `social-publishers.ts` utilise `graph.instagram.com`, crée un container sur `/<account_id>/media`, attend `status_code`, puis appelle `/<account_id>/media_publish`.
- Le code exige une URL média publique pour Instagram, ce qui correspond au prérequis Meta.
- Le code traite les vidéos comme `REELS`, ce qui est une voie de publication documentée pour les vidéos courtes, même si les paramètres de validation et les scénarios Stories/carrousels ne sont pas implémentés.

### Écarts bloquants ou importants pour l’analytics

1. **Scope manquant.** `social-oauth.ts` ne demande pas `instagram_business_manage_insights`. Les appels aux deux endpoints Insights seront donc refusés ou inutilisables pour les comptes clients jusqu’à ajout et activation de cette permission.
2. **Aucun endpoint Insights.** Aucun appel à `/<account_id>/insights` ou `/<media_id>/insights` n’existe dans `social-publishers.ts` ou dans le fichier OAuth.
3. **Aucune synchronisation média.** Le code ne lit pas `GET /<IG_ID>/media`, ne conserve pas les IDs IG Media et ne peut pas faire de collecte publication par publication.
4. **Version incohérente.** `API_VERSION` vaut `v27.0`, mais l’identité Instagram et le publisher utilisent en dur `v24.0`. Les références Meta consultées documentent `v27.0` comme dernière version ; la version doit être centralisée pour éviter des comportements divergents et des métriques différentes.
5. **Tokens courts non renouvelés.** L’implémentation ne réalise pas l’échange vers un token long-lived valable 60 jours ni le refresh avant expiration.
6. **Absence de gestion des quotas.** Aucun appel à `content_publishing_limit`, aucune persistance de compteurs, aucun contrôle de quota et aucun traitement des en-têtes d’usage n’est visible.
7. **Publication sans carrousel.** Le code gère une image ou un Reel, mais pas le flux de containers enfants puis container `CAROUSEL` ; ce n’est pas un défaut de base pour l’analytics, mais cela limite la couverture de publication.
8. **Polling fixe.** Le publisher fait au maximum 12 vérifications espacées de 2,5 secondes. La documentation exige de vérifier l’état du container mais ne garantit pas que tout média sera prêt dans 30 secondes ; le worker devrait traiter explicitement les statuts d’erreur et différer les containers encore en traitement.
9. **Réponse de publication partiellement ignorée.** Le code conserve `published.id`, mais ne préserve pas les champs éventuels tels que `config_issue`, utiles pour signaler qu’une publication a réussi sans caption ou sans certains paramètres.
10. **Pas de webhook d’insights disponible avec cette configuration.** Comme Meta ne supporte pas les webhooks d’insights avec Instagram Login, TrafficFlow doit prévoir une tâche planifiée et idempotente, en tenant compte du délai possible de 48 heures.

## Endpoints serveur à prévoir pour une couverture complète

Pour l’implémentation actuelle d’Instagram Login, les appels côté serveur devraient au minimum couvrir :

```text
POST https://api.instagram.com/oauth/access_token
GET  https://graph.instagram.com/access_token
GET  https://graph.instagram.com/refresh_access_token
GET  https://graph.instagram.com/v27.0/<IG_ID>?fields=id,username
GET  https://graph.instagram.com/v27.0/<IG_ID>/media?fields=id,caption,media_type,media_product_type,timestamp,permalink
GET  https://graph.instagram.com/v27.0/<IG_ID>/insights
GET  https://graph.instagram.com/v27.0/<IG_MEDIA_ID>/insights
POST https://graph.instagram.com/v27.0/<IG_ID>/media
GET  https://graph.instagram.com/v27.0/<IG_CONTAINER_ID>?fields=status_code
POST https://graph.instagram.com/v27.0/<IG_ID>/media_publish
GET  https://graph.instagram.com/v27.0/<IG_ID>/content_publishing_limit
```

Les permissions minimales à demander pour publication + analytics sont `instagram_business_basic`, `instagram_business_content_publish` et `instagram_business_manage_insights`. Les paramètres `metric`, `period`, `metric_type`, `breakdown`, `since`, `until` et `timeframe` doivent être construits selon les compatibilités de chaque métrique ; Meta précise qu’un breakdown incompatible peut produire une erreur générique, et que les réponses vides signifient parfois que les données ne sont pas disponibles plutôt que zéro [2] [3].

## Verdict

**Publication Instagram : partiellement opérationnelle**, sous réserve d’un compte professionnel, d’un média public et d’un token valide ; le flux de containers utilisé est conforme dans ses grandes lignes.

**Analytics Instagram : non implémentée et non autorisée par le consentement actuel.** Le gap principal est l’absence de `instagram_business_manage_insights`, suivie par l’absence totale de collecte, de stockage des IDs de médias et de renouvellement de tokens.

**Compatibilité production multi-clients : incomplète.** Elle nécessite Advanced Access et la vérification/revue Meta appropriées, une gestion robuste des tokens long-lived, une collecte planifiée des insights, des limites de quota et l’alignement sur une seule version API actuelle.

## Références

[1]: https://developers.facebook.com/documentation/instagram-platform/overview "Instagram Platform overview"
[2]: https://developers.facebook.com/documentation/instagram-platform/api-reference/instagram-user/insights "Instagram Account Insights"
[3]: https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights "Instagram Media Insights"
[4]: https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media "IG Media"
[5]: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login "Instagram API with Instagram Login"
[6]: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login "Business Login for Instagram"
[7]: https://developers.facebook.com/documentation/development/graph-api/overview/access-levels "Access Levels"
[8]: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ "Rate Limits - Graph API"
[9]: https://developers.facebook.com/documentation/instagram-platform/content-publishing "Content Publishing"
[10]: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media_publish "IG User Media Publish"
