begin;

alter table public.social_accounts add column if not exists oauth_provider text;
alter table public.social_accounts add column if not exists provider_account_id text;
alter table public.social_accounts add column if not exists access_token_encrypted text;
alter table public.social_accounts add column if not exists refresh_token_encrypted text;
alter table public.social_accounts add column if not exists token_expires_at timestamptz;
alter table public.social_accounts add column if not exists oauth_scopes text not null default '';
create unique index if not exists social_accounts_provider_identity_idx on public.social_accounts(workspace_id, oauth_provider, provider_account_id) where provider_account_id is not null;

alter table public.posts add column if not exists publish_attempts integer not null default 0 check (publish_attempts >= 0);
alter table public.posts add column if not exists last_publish_error text;
alter table public.posts add column if not exists provider_post_id text;
alter table public.posts add column if not exists provider_post_url text;
alter table public.posts add column if not exists provider_response jsonb not null default '{}'::jsonb;
create index if not exists posts_due_publication_idx on public.posts(status, scheduled_at) where status = 'scheduled';

create or replace function public.trafficflow_claim_due_posts(p_limit integer default 10)
returns table(
  id integer, workspace_id uuid, social_account_id integer, title text, caption text,
  hashtags text, cta text, media_type text, media_source_url text, created_by uuid,
  platform text, provider_account_id text, access_token_encrypted text,
  refresh_token_encrypted text, token_expires_at timestamptz, publish_attempts integer
) language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select p.id
    from public.posts p
    join public.social_accounts sa on sa.id = p.social_account_id and sa.connection_status = 'connected'
    where p.status = 'scheduled'
      and p.scheduled_at is not null
      and p.scheduled_at <= now()
    order by p.scheduled_at asc, p.id asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.posts p
    set status = 'processing', updated_at = now(), publish_attempts = p.publish_attempts + 1
    from candidates c
    where p.id = c.id
    returning p.*
  )
  select c.id, c.workspace_id, c.social_account_id, c.title, c.caption, c.hashtags, c.cta,
    m.media_type, coalesce(m.source_url, '') as media_source_url, c.created_by,
    sa.platform, sa.provider_account_id, sa.access_token_encrypted,
    sa.refresh_token_encrypted, sa.token_expires_at, c.publish_attempts
  from claimed c
  left join public.media m on m.id = c.media_id
  join public.social_accounts sa on sa.id = c.social_account_id
  where sa.connection_status = 'connected';
end;
$$;
revoke all on function public.trafficflow_claim_due_posts(integer) from public, anon, authenticated;
grant execute on function public.trafficflow_claim_due_posts(integer) to service_role;

commit;
