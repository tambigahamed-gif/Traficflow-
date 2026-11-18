# Audit X API v2 pour TrafficFlow

Date de vérification : 16 novembre 2026. Périmètre : documentation officielle X API v2 actuellement publiée et comparaison en lecture seule avec `server/integrations/social-oauth.ts` et `server/integrations/social-publishers.ts`.

## Conclusion opérationnelle

X API v2 peut alimenter une analytics de publication pour les posts X appartenant au compte connecté. Les métriques publiques (`public_metrics`) sont disponibles avec l’authentification API appropriée ; les métriques non publiques, organiques et promues exigent un contexte utilisateur OAuth et sont limitées aux posts créés dans les 30 derniers jours. Les endpoints serveur réellement pertinents sont `GET /2/users/me`, `POST /2/tweets`, les endpoints d’upload média v2, et `GET /2/tweets/:id` avec les champs de métriques. [1] [2] [3] [4]

Le code TrafficFlow sait aujourd’hui connecter un compte X en OAuth 2.0 Authorization Code + PKCE et publier du texte via `POST https://api.x.com/2/tweets`. Il ne collecte aucune analytics et ne sait pas publier les médias X. Surtout, le code envoie les scopes OAuth avec des virgules (`tweet.read,tweet.write,...`) alors que la documentation X construit la requête avec des scopes séparés par des espaces ; ce point doit être considéré comme un défaut bloquant de connexion/permissions jusqu’à validation dans l’environnement X. [2]

## Capacités Analytics / insights documentées

La documentation X décrit l’API v2 comme donnant accès aux métriques, tendances et analytics d’engagement. Pour un post, les champs documentés sont notamment :

- `public_metrics.retweet_count`, `quote_count`, `like_count`, `reply_count`, `impression_count` et `bookmark_count` ;
- `non_public_metrics.url_link_clicks`, `user_profile_clicks` et `engagements` ;
- `organic_metrics` pour la composante non promue ;
- `promoted_metrics` pour les vues issues de la publicité ;
- pour la vidéo, `public_metrics.view_count` et les métriques de lecture à 0/25/50/75/100 % dans `non_public_metrics`.

La page Metrics actuellement publiée classe `public_metrics` comme accessibles avec un Bearer Token et les métriques non publiques, organiques et promues comme nécessitant le contexte utilisateur. Les métriques privées concernent les posts possédés par l’utilisateur authentifié ; les métriques promues sont pertinentes pour les posts promus. La même page impose une fenêtre de 30 jours pour les métriques non publiques, organiques et promues. [1]

Le chemin de lecture minimal pour un post connu est `GET https://api.x.com/2/tweets/{id}?tweet.fields=public_metrics` pour les métriques publiques. Pour les métriques privées, la documentation montre `tweet.fields=non_public_metrics,organic_metrics` avec une authentification utilisateur. Pour la vidéo, il faut demander `expansions=attachments.media_keys` et `media.fields=public_metrics,non_public_metrics`. [1]

X ne documente pas dans l’API v2 standard un endpoint distinct de type « dashboard analytics » qui fournirait une série historique complète par compte comparable à une console native. TrafficFlow devra donc persister périodiquement les snapshots de métriques par post, ou utiliser les endpoints Ads API si le besoin porte sur les campagnes payantes. La documentation de la plateforme distingue explicitement X Ads API, qui comporte ses propres analytics de campagnes, de X API v2. [5]

## Permissions et OAuth

Le flux documenté pour une application serveur est OAuth 2.0 Authorization Code Flow with PKCE. Les scopes utiles au cas TrafficFlow sont :

- `tweet.read` pour lire les posts et leurs champs ;
- `tweet.write` pour créer des posts ;
- `users.read` pour `GET /2/users/me` et les informations de compte ;
- `media.write` pour uploader les médias ;
- `offline.access` pour obtenir un refresh token et maintenir la connexion sans nouvelle autorisation interactive.

La documentation précise qu’un access token sans `offline.access` expire par défaut après deux heures. Avec `offline.access`, X émet un refresh token. Les callback URLs doivent correspondre exactement à celles configurées dans le Developer Console. [2]

Dans `social-oauth.ts`, TrafficFlow demande bien `tweet.read`, `tweet.write`, `users.read`, `media.write` et `offline.access`, stocke le refresh token lorsqu’il est renvoyé et utilise PKCE S256. En revanche, la ligne qui construit `scope` utilise une virgule pour X, alors que l’exemple officiel et le format OAuth attendu utilisent des scopes séparés par des espaces. Il faut aussi prévoir le renouvellement effectif du token : le code lit et stocke le refresh token, mais `getSocialCredentials` ne rafraîchit jamais un access token arrivé à expiration.

Les métriques privées n’exigent pas un nouveau scope analytique dédié dans la page Metrics ; elles exigent surtout un user context et que le post soit possédé par l’utilisateur authentifié. Les endpoints de lecture de relations, likes, bookmarks, listes ou DMs demanderaient en plus les scopes correspondants (`like.read`, `bookmark.read`, `follows.read`, `list.read`, `dm.read`, etc.) ; ils ne sont pas nécessaires pour les métriques de base des propres posts.

## Endpoints réellement utilisables côté serveur

### Identité du compte

`GET https://api.x.com/2/users/me` est l’endpoint adapté pour identifier l’utilisateur autorisé. Il est appelé dans `social-oauth.ts` et le résultat `data.id` / `data.username` est cohérent avec le modèle d’identité utilisé par TrafficFlow. Le token doit être un token utilisateur, pas seulement un Bearer Token d’application, si TrafficFlow veut publier ou lire des métriques privées. [6]

### Publication de texte

`POST https://api.x.com/2/tweets` est l’endpoint v2 documenté pour créer ou éditer un post. Il demande `tweet.write`, avec `tweet.read` et `users.read` indiqués dans les autorisations de la référence. Le code `publishX` envoie `{ text }` avec un Bearer access token utilisateur et récupère `data.id`; cela correspond au contrat documenté pour un post texte. Le coût publié est actuellement de 0,015 USD par création standard, et 0,20 USD lorsqu’un post contient une URL, sous réserve des tarifs affichés dans le Developer Console. [3] [4]

### Publication avec média

X v2 exige un upload préalable, puis le passage du ou des `media_id` dans `POST /2/tweets`. Les endpoints v2 documentés sont `POST /2/media/upload/initialize`, les appels d’append, puis finalize ; l’upload chunked est recommandé pour les vidéos. Une publication accepte jusqu’à quatre photos, un GIF animé ou une vidéo. Les limites de taille/durée dépendent du statut Premium/vérifié du compte qui publie, et non du plan développeur : par défaut, vidéo jusqu’à 20 minutes et 8 GB ; compte Premium/vérifié, jusqu’à 125 minutes et 16 GB. L’upload réussi ne garantit pas que l’attachement sera accepté au moment de la publication ; TrafficFlow doit gérer le 403 de création. [4]

Dans `social-publishers.ts`, `publishX` refuse tout `mediaUrl` avec l’erreur « utiliser l’upload media v2 ». C’est une protection honnête, mais elle signifie que la publication vidéo/image n’est pas implémentée. Le code doit donc ajouter une étape d’upload et transmettre `media: { media_ids: [...] }` à `/2/tweets` avant de déclarer la capacité média disponible.

### Lecture des insights

Pour un post publié par TrafficFlow, le serveur peut appeler :

```text
GET https://api.x.com/2/tweets/{post_id}?tweet.fields=public_metrics,non_public_metrics,organic_metrics,promoted_metrics&expansions=attachments.media_keys&media.fields=public_metrics,non_public_metrics
Authorization: Bearer <user access token>
```

En pratique, il faut adapter les champs à l’âge et au type du post : demander `non_public_metrics`, `organic_metrics` ou `promoted_metrics` sur un post hors fenêtre ou non possédé peut produire une erreur ou des champs absents. Le code existant ne contient aucun appel GET de ce type, aucune table/snapshot d’insights et aucun job de synchronisation.

## Quotas, coûts et contraintes importantes

Les rate limits X sont propres à chaque endpoint, avec généralement des fenêtres de 15 minutes ou 24 heures, et une distinction entre limites par application et par utilisateur. Les réponses exposent `x-rate-limit-limit`, `x-rate-limit-remaining` et `x-rate-limit-reset`; un dépassement renvoie HTTP 429 jusqu’au reset. [7]

Pour les opérations pertinentes de TrafficFlow, la documentation publiée indique notamment : `POST /2/tweets` à 100 par utilisateur sur 15 minutes et 10 000 par application sur 24 heures ; `GET /2/tweets/{id}` à 900 par utilisateur et 450 par application sur 15 minutes ; `GET /2/users/me` à 75 par utilisateur sur 15 minutes. Les valeurs peuvent évoluer et doivent être observées dans les headers et le Developer Console plutôt que codées en dur. [7]

Le modèle de facturation actuel est pay-per-use : les crédits sont achetés dans le Developer Console et les lectures sont facturées par ressource, tandis que les écritures sont facturées par requête. Les « Owned Reads » éligibles, dont les posts, mentions, followers et following propres au compte, sont tarifés à 0,001 USD par ressource. Les plans pay-per-use sont plafonnés à 3 millions de lectures de posts par cycle mensuel ; au-delà, il faut un plan Enterprise. Les crédits peuvent bloquer les requêtes quand le solde atteint zéro ou devient négatif, et une limite de dépense par cycle est disponible. [4]

La limite analytics la plus importante pour TrafficFlow est la fenêtre de 30 jours des métriques non publiques, organiques et promues. Pour conserver des historiques plus longs, il faut interroger régulièrement et enregistrer les snapshots avant expiration de cette fenêtre. Les métriques publiques ne doivent pas être assimilées à des utilisateurs uniques : par exemple, une impression compte chaque affichage, y compris plusieurs affichages par la même personne. [1]

La création de posts avec quote-post (`quote_tweet_id`) est documentée comme réservée à l’Enterprise et non disponible sur les offres self-serve pay-per-use. Les opérations de follow, like et quote-post ont également fait l’objet de retraits des offres self-serve selon le changelog ; elles ne doivent donc pas être promises par TrafficFlow sans vérifier le plan du projet. [3] [5]

## Conditions de compte et d’application

L’équipe doit créer une application dans le Developer Console, activer OAuth 2.0 et configurer exactement les callback URLs. Pour un client serveur confidentiel, le secret client doit rester côté serveur. L’utilisateur final doit autoriser les scopes demandés et disposer d’un compte X capable de publier ; les plafonds vidéo et certaines capacités de publication dépendent du statut Premium/vérifié du compte utilisateur. Les crédits et les limites de dépense du projet doivent être provisionnés pour éviter des erreurs au runtime. [2] [4]

Le plan Enterprise devient nécessaire pour les volumes supérieurs au self-serve, les rate limits personnalisés, ou les fonctionnalités explicitement marquées Enterprise comme le quote-post. La plateforme présente Enterprise comme l’offre à haut volume avec gestion de compte dédiée et limites personnalisées. [5] [7]

## Écart TrafficFlow et matrice de couverture

- **OAuth et identité : partiellement couvert.** `social-oauth.ts` utilise les bons endpoints X et stocke les tokens, mais le séparateur de scopes est incorrect pour le format documenté et aucun refresh automatique n’est implémenté.
- **Publication texte : couvert sous réserve OAuth.** `publishX` appelle correctement `POST /2/tweets` et renvoie l’identifiant de post.
- **Publication média : non couvert.** Le worker refuse volontairement les URLs média et ne réalise pas les étapes d’upload v2.
- **Métriques publiques : non couvert.** Aucun appel `GET /2/tweets/{id}` avec `tweet.fields=public_metrics`.
- **Métriques privées/organic/promoted : non couvert.** Aucun appel avec les champs correspondants, aucune vérification de propriété du post et aucune gestion de la fenêtre de 30 jours.
- **Historisation analytics : non couvert.** Aucun stockage de snapshots, planification de collecte ou stratégie de réessai/429 visible dans les deux fichiers audités.
- **Observabilité et coûts : non couvert.** Les wrappers d’erreur remontent le statut HTTP, mais ne lisent pas les headers `x-rate-limit-*`, ne distinguent pas 401/403/429 et ne surveillent pas le crédit pay-per-use.
- **Réconciliation après publication : non couvert.** Le code conserve l’id de publication dans le résultat, mais aucune étape ne relit ensuite le post pour valider les champs analytiques ou les médias.

## Verdict

X API v2 est exploitable côté serveur pour publier du texte et collecter des insights de posts appartenant au compte connecté, mais pas comme une source historique illimitée ni comme un équivalent complet d’un dashboard Ads. Pour TrafficFlow, le minimum avant de déclarer X « analytics-ready » est de corriger le format des scopes, implémenter le refresh token, ajouter la lecture des métriques et leur persistance périodique, puis gérer explicitement 30 jours, 429, crédits et métriques absentes. La publication média nécessite en plus l’upload v2 et la gestion des limites du compte publiant.

## Références

[1]: https://docs.x.com/x-api/fundamentals/metrics "Metrics — X API v2"
[2]: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code "OAuth 2.0 Authorization Code Flow with PKCE — X"
[3]: https://docs.x.com/x-api/posts/create-post "Create or Edit Post — X API v2"
[4]: https://docs.x.com/x-api/getting-started/pricing "X API pay-per-use pricing and credits — X"
[5]: https://docs.x.com/overview "X Developer Platform overview"
[6]: https://docs.x.com/x-api/users/get-me "Get authenticated user — X API v2"
[7]: https://docs.x.com/x-api/fundamentals/rate-limits "X API rate limits — X API v2"
[8]: https://docs.x.com/x-api/media/introduction "Media upload endpoints — X API v2"
[9]: https://docs.x.com/changelog "X API changelog and release notes"
