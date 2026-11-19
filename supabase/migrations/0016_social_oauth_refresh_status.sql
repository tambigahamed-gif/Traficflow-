-- TrafficFlow 0016 — suivi du renouvellement OAuth.
-- Migration additive : ne supprime aucun compte ni token. À appliquer après 0015.

alter table public.social_accounts
  add column if not exists oauth_last_error text,
  add column if not exists token_refreshed_at timestamptz,
  add column if not exists refresh_token_expires_at timestamptz;

comment on column public.social_accounts.oauth_last_error is
  'Dernière erreur OAuth non secrète ; peut signaler qu une reconnexion est nécessaire.';
comment on column public.social_accounts.token_refreshed_at is
  'Date du dernier renouvellement serveur réussi du token d accès.';
comment on column public.social_accounts.refresh_token_expires_at is
  'Expiration du refresh token lorsque le fournisseur la communique.';
