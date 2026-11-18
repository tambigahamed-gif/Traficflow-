# TrafficFlow — intégrations OAuth et publication

Cette archive ajoute les routes OAuth sociales, le chiffrement AES-256-GCM des tokens côté serveur et le worker Vercel de publication. Les applications développeur, les permissions et les revues de chaque fournisseur restent à configurer dans leurs consoles officielles.

## Flux couverts

- Instagram : compte professionnel, `instagram_business_basic` et `instagram_business_content_publish`, conteneur média puis publication.
- Facebook : Page avec `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`, sélection d’une Page disposant de `CREATE_CONTENT`.
- Threads : `threads_basic` et `threads_content_publish`, conteneur puis publication.
- TikTok : `video.publish`, publication directe vidéo/photo avec URL publique et statut privé par défaut pour respecter les contraintes d’audit.
- YouTube : `youtube.readonly` et `youtube.upload`, upload vidéo multipart ; le Data API v3 ne publie pas de post texte/image autonome.
- LinkedIn : `w_member_social`, publication texte dans `/rest/posts`; la publication organisationnelle nécessite `w_organization_social` et une autorisation supplémentaire.
- X : OAuth 2.0 PKCE, `tweet.read`, `tweet.write`, `users.read`, `media.write`, publication texte. Les médias X doivent passer par l’upload v2 avant le post.

## Variables serveur ajoutées

`SOCIAL_OAUTH_STATE_SECRET` signe l’état OAuth. `SOCIAL_TOKEN_ENCRYPTION_KEY` chiffre les access/refresh tokens. Les secrets des fournisseurs sont uniquement côté serveur. `CRON_SECRET` protège `/api/cron/publish` et `/api/cron/subscriptions`.

## Sources officielles

- [Instagram Platform](https://developers.facebook.com/documentation/instagram-platform/overview)
- [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- [Facebook Pages API](https://developers.facebook.com/documentation/pages-api/overview)
- [Facebook Login manual flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [Threads API](https://developers.facebook.com/documentation/threads)
- [TikTok Login Kit](https://developers.tiktok.com/doc/login-kit-web)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [YouTube OAuth](https://developers.google.com/youtube/v3/guides/authentication)
- [YouTube video upload](https://developers.google.com/youtube/v3/guides/uploading_a_video)
- [LinkedIn authorization code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10)
- [X OAuth 2.0 PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code.md)
- [X create post](https://docs.x.com/x-api/posts/create-post.md)
- [X media upload](https://docs.x.com/x-api/media/upload-media.md)

Les versions d’API et les permissions doivent être revérifiées dans les consoles des fournisseurs avant la mise en production, car elles évoluent indépendamment de TrafficFlow.
