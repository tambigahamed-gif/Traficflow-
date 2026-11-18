# Audit de la plateforme Threads API pour TrafficFlow

**Date de vérification : 16 novembre 2026**  
**Périmètre :** documentation officielle Meta/Threads actuellement publiée et comparaison en lecture seule avec `server/integrations/social-oauth.ts` et `server/integrations/social-publishers.ts`.

## Conclusion opérationnelle

Threads fournit une API serveur exploitable pour publier du texte, des images, des vidéos et des carrousels, lire les profils et les publications, gérer certaines réponses, recevoir des webhooks et consulter des insights de profils et de médias. L’API utilise les hôtes `graph.threads.com` ou `graph.threads.net`, avec des endpoints versionnés en `v1.0` dans les exemples officiels. [1]

Le code TrafficFlow couvre correctement le socle OAuth Threads et la publication simple texte/image/vidéo, mais il ne couvre pas l’Analytics/insights. Son autorisation demande seulement `threads_basic,threads_content_publish`, alors que les insights nécessitent `threads_manage_insights`; les permissions de lecture/gestion des réponses et celles de découverte de profils sont également absentes. La gestion des tokens est le principal risque de production : le callback échange le code contre un token court et le stocke directement, alors que les tokens courts expirent après une heure et que les tokens longs valables 60 jours doivent être obtenus puis rafraîchis côté serveur. [2] [3] [4]

## Capacités Analytics / insights documentées

### Insights de publication

`GET /{threads-media-id}/insights` permet de demander une liste métrique comma-separated. Les métriques documentées sont : `views`, `likes`, `replies`, `reposts`, `quotes` et `shares`. `views` et `shares` sont marquées « in development » par Meta. Les résultats ne capturent pas les métriques des réponses imbriquées. Pour les posts `REPOST_FACADE`, la réponse est un tableau vide car il s’agit de posts créés par d’autres utilisateurs. [5]

La portée est celle des publications Threads de l’utilisateur autorisé, et non un reporting universel de tout Threads. Les `replies` ont une sémantique différente selon que l’objet demandé est un post racine ou une réponse : les premières incluent le total des réponses, les secondes seulement les réponses directes.

### Insights de profil

`GET /{threads-user-id}/threads_insights` accepte `metric` et, pour les métriques compatibles, `since`/`until`. Les métriques documentées sont :

- `views` : série temporelle des vues du profil ;
- `likes`, `replies`, `reposts`, `quotes` : valeurs totales sur les posts de l’utilisateur ; les réponses comptées sont seulement les réponses de premier niveau ;
- `clicks` : clics sur les URLs partagées, avec valeurs par lien ;
- `followers_count` : nombre total d’abonnés ; non compatible avec `since`/`until` ;
- `follower_demographics` : pays, villes, âge et genre via un seul `breakdown` à la fois. Cette métrique exige au moins 100 abonnés et n’accepte pas `since`/`until`. [5]

Sans `since` et `until`, les insights utilisateur retombent sur une fenêtre de deux jours, d’hier à aujourd’hui. Les dates antérieures au timestamp Unix `1712991600` (13 avril 2024) sont rejetées pour les paramètres de période. Meta indique aussi que les insights utilisateur ne sont pas garantis avant le 1er juin 2024. [5]

### Permission Analytics

Tous les endpoints Threads nécessitent `threads_basic`. Les endpoints Insights en lecture nécessitent en plus `threads_manage_insights`. La permission `threads_content_publish` ne donne pas accès aux insights. [5]

## Permissions, scopes et conditions de compte

Les scopes officiellement documentés pour le périmètre pertinent sont :

- `threads_basic` : obligatoire pour tous les endpoints Threads ;
- `threads_content_publish` : publication ;
- `threads_manage_insights` : lecture des insights ;
- `threads_read_replies` : lecture des réponses ;
- `threads_manage_replies` : création/modération des réponses ;
- `threads_profile_discovery` : recherche d’un profil public et de ses posts ;
- `threads_manage_mentions` : gestion des mentions, notamment pour certains webhooks ;
- `threads_delete` : suppression de posts et quota de suppression ;
- `threads_location_tagging` : recherche de lieux et quota associé. [2] [3] [6]

L’application doit être créée avec le use case Threads. Meta indique que le Threads App ID et le Threads App secret dédiés, visibles dans les réglages de l’app, doivent être utilisés pour l’implémentation Threads. Un serveur public est requis car Threads télécharge les URLs de médias lors de la publication. [2]

En mode test, les permissions peuvent être accordées par des Threads testers invités et ayant accepté l’invitation. Pour les utilisateurs sans rôle sur l’app, chaque permission doit être approuvée via App Review et l’application doit être publiée. Les grants d’utilisateurs à profil public sont valables 90 jours ; le rafraîchissement du token long peut prolonger ce grant de 90 jours. Pour un profil privé, le grant ne peut pas être prolongé et l’utilisateur doit réautoriser l’app à expiration. [2] [4]

Les tokens courts sont valables une heure. Ils peuvent être échangés côté serveur contre des tokens longs valables 60 jours, puis rafraîchis avant expiration lorsqu’ils ont au moins 24 heures et sont encore valides. Le secret d’app est requis pour l’échange et ne doit jamais être exposé au client. [4]

Pour les webhooks, Meta exige notamment le sous-use-case Threads Webhooks, les permissions adaptées, le mode Live pour les fournisseurs non techniques ou l’advanced access pour les fournisseurs techniques, ainsi que la vérification de l’entreprise connectée. Les notifications de réponses et de mentions sont limitées lorsque le média source appartient à un compte privé. [7]

## Quotas et contraintes importantes

Le quota de publication est de **250 posts publiés par profil dans une fenêtre glissante de 24 heures** ; un carrousel compte comme un seul post. Le endpoint officiel `GET /{threads-user-id}/threads_publishing_limit?fields=quota_usage,config` permet de lire l’usage et la configuration du quota. [1]

Le quota de réponses est de **1 000 réponses par profil sur 24 heures**. Le quota de suppressions est de **100 suppressions par 24 heures**. Les recherches de lieux sont limitées à **500 par 24 heures**. [1]

Au niveau appels API, le call count d’une paire app/utilisateur est calculé sur une fenêtre glissante de 24 heures selon `4800 × nombre d’impressions`, avec un minimum de 10 impressions. Meta documente aussi des budgets quotidiens CPU et temps total liés aux impressions. [1]

Contraintes de contenu : texte limité à 500 caractères, avec comptage des emojis selon le nombre d’octets UTF-8 ; carrousels de 2 à 20 enfants ; images JPEG/PNG jusqu’à 8 MB, largeur de 320 à 1440 px et ratio maximal 10:1 ; vidéos MOV/MP4, jusqu’à 5 minutes et 1 GB, avec codecs et ratios documentés. [1] [6]

La création est asynchrone en deux étapes : `POST /{threads-user-id}/threads` crée un media container, puis `POST /{threads-user-id}/threads_publish` le publie. La documentation demande d’attendre environ 30 secondes avant la publication afin de laisser le média être traité ; un endpoint de statut est prévu pour vérifier le traitement. [6]

## Endpoints réellement utilisables côté serveur

Avec un token utilisateur Threads valide et les scopes correspondants, les endpoints documentés et pertinents sont :

- OAuth : `https://threads.com/oauth/authorize`, puis `POST https://graph.threads.com/oauth/access_token` ;
- token long : `GET https://graph.threads.com/access_token?grant_type=th_exchange_token...` ;
- rafraîchissement : `GET https://graph.threads.com/refresh_access_token?grant_type=th_refresh_token...` ;
- identité : `GET /{threads-user-id}?fields=id,username,...` ;
- posts du compte autorisé : `GET /{threads-user-id}/threads` ;
- profil et posts publics : `GET /profile_lookup?username=...` et `GET /profile_posts?username=...` avec `threads_profile_discovery` ;
- publication : `POST /{threads-user-id}/threads`, puis `POST /{threads-user-id}/threads_publish` ;
- insights média : `GET /{threads-media-id}/insights` avec `threads_manage_insights` ;
- insights profil : `GET /{threads-user-id}/threads_insights` avec `threads_manage_insights` ;
- quota : `GET /{threads-user-id}/threads_publishing_limit` avec les permissions propres au champ demandé ;
- réponses, mentions, suppression et webhooks selon les scopes additionnels documentés. [1] [3] [5] [6] [7]

La référence officielle limite la liste des posts d’un utilisateur à une pagination de 25 par défaut et 100 maximum par requête. Les curseurs `before` et `after` ne sont pas utilisables ensemble. La découverte de profils publics exige en outre au moins 100 abonnés pour le profil ciblé ; en standard access, les posts récupérables sont limités à certains comptes officiels Meta. [3] [6]

## Comparaison avec TrafficFlow

### Ce qui est conforme ou partiellement conforme

`social-oauth.ts` utilise bien `https://threads.com/oauth/authorize` et `https://graph.threads.com/oauth/access_token`, demande `response_type=code`, conserve un `state` signé contre la falsification et appelle `GET https://graph.threads.com/v1.0/me?fields=id,username` pour l’identité. Ces URLs et le format de scope comma-separated sont compatibles avec les exemples officiels. [3]

`social-publishers.ts` cible les bons endpoints de création et publication en `v1.0`, distingue `TEXT`, `IMAGE` et `VIDEO`, et transmet des URLs média publiques. La publication simple est donc conceptuellement alignée avec l’API.

### Écarts bloquants ou importants

1. **Analytics absent.** Aucun code ne compose ou appelle `/{media-id}/insights` ou `/{user-id}/threads_insights`. TrafficFlow ne peut donc actuellement afficher aucun insight Threads.

2. **Scope Analytics absent.** Le scope OAuth actuel est `threads_basic,threads_content_publish`. Il faut demander `threads_manage_insights` pour l’Analytics. Si TrafficFlow ajoute la lecture ou la modération des réponses, il faut aussi demander explicitement `threads_read_replies` et/ou `threads_manage_replies`.

3. **Pas d’échange long-lived.** Le callback stocke le token renvoyé par l’échange du code. D’après la documentation, cet échange produit un token court d’une heure. Le code ne réalise pas l’appel serveur `GET /access_token?grant_type=th_exchange_token`, ne stocke pas de manière fiable l’expiration du token long et ne planifie pas `GET /refresh_access_token`. Une publication ou collecte planifiée peut donc échouer après expiration.

4. **Confusion possible des secrets d’app.** Le code autorise `THREADS_CLIENT_ID/SECRET` puis retombe sur `META_APP_ID/SECRET`. Meta exige l’App ID et le secret du use case Threads. Le fallback générique doit être vérifié dans le déploiement, car il peut sélectionner le mauvais couple de credentials.

5. **Délai de traitement trop court.** Le publisher attend trois secondes fixes avant `threads_publish`, alors que la documentation recommande environ 30 secondes et renvoie vers le contrôle de statut. Un polling du statut avec gestion des erreurs est nécessaire pour éviter les échecs intermittents et les faux diagnostics.

6. **Pas de contrôle de quota.** Le worker ne consulte pas `threads_publishing_limit` et ne réserve pas de capacité avant une publication planifiée. Le plafond de 250 publications/24 h peut être dépassé, surtout avec des campagnes ou des retries.

7. **Contraintes non validées.** Le code ne vérifie pas la limite texte de 500 caractères, le comptage UTF-8 des emojis, les tailles/formats/ratio des médias, ni la durée et taille vidéo. Il ne supporte pas les carrousels, pourtant officiellement disponibles jusqu’à 20 enfants.

8. **Support fonctionnel incomplet.** Aucun chemin n’existe pour les réponses, mentions, suppression, découverte de profils, webhooks ou label `is_made_with_ai`. Ces fonctionnalités ne sont pas obligatoires pour publier, mais elles doivent être explicitement marquées comme non supportées côté produit.

9. **Observabilité Analytics absente.** Le schéma de publication ne conserve que l’ID et la réponse brute. Il n’existe ni synchronisation périodique des métriques, ni normalisation des séries temporelles, ni traitement des cas `views/shares` en développement, des démographies exigeant 100 abonnés, ou des périodes par défaut de deux jours.

## Verdict

**Publication simple : partiellement prête**, sous réserve de remplacer l’attente fixe de trois secondes par un contrôle de statut et de traiter les tokens longs.  
**Analytics : non implémenté**, mais officiellement disponible pour profils et médias avec `threads_manage_insights`.  
**Usage multi-compte en production : à risque** tant que le refresh de token, App Review/advanced access, quotas et conditions de profil public/privé ne sont pas gérés.

## Références

[1]: https://developers.facebook.com/documentation/threads/overview "Threads API overview"
[2]: https://developers.facebook.com/documentation/threads/get-started "Get started with the Threads API"
[3]: https://developers.facebook.com/documentation/threads/get-started/get-access-tokens-and-permissions "Get access tokens"
[4]: https://developers.facebook.com/documentation/threads/get-started/long-lived-tokens "Threads long-lived access tokens"
[5]: https://developers.facebook.com/documentation/threads/insights "Threads Insights API"
[6]: https://developers.facebook.com/documentation/threads/posts "Threads posts"
[7]: https://developers.facebook.com/documentation/threads/webhooks "Webhooks for Threads"
[8]: https://developers.facebook.com/documentation/threads/reference/user "Threads user reference"
