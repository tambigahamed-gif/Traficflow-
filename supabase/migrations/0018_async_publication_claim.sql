-- TrafficFlow 0018 — reprise des publications asynchrones.
-- Migration additive : ne modifie aucune donnée existante et remplace uniquement la signature
-- de la fonction de réservation afin de retourner provider_response au worker.

begin;

drop function if exists public.trafficflow_claim_due_posts(integer);
create function public.trafficflow_claim_due_posts(p_limit integer default 10)
returns table(
  id integer, workspace_id uuid, social_account_id integer, title text, caption text,
  hashtags text, cta text, media_type text, media_source_url text, created_by uuid,
  platform text, provider_account_id text, access_token_encrypted text,
  refresh_token_encrypted text, token_expires_at timestamptz, publish_attempts integer,
  provider_response jsonb
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
    sa.refresh_token_encrypted, sa.token_expires_at, c.publish_attempts, c.provider_response
  from claimed c
  left join public.media m on m.id = c.media_id
  join public.social_accounts sa on sa.id = c.social_account_id
  where sa.connection_status = 'connected';
end;
$$;
revoke all on function public.trafficflow_claim_due_posts(integer) from public, anon, authenticated;
grant execute on function public.trafficflow_claim_due_posts(integer) to service_role;

commit;
