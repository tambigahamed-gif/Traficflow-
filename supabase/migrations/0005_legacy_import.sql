begin;

create unique index if not exists social_accounts_workspace_id_id_uq on public.social_accounts(workspace_id,id);
create unique index if not exists media_workspace_id_id_uq on public.media(workspace_id,id);
create unique index if not exists posts_workspace_id_id_uq on public.posts(workspace_id,id);

-- Composite tenant FKs prevent an authorized member of multiple workspaces from creating cross-workspace references.
alter table public.posts drop constraint if exists posts_account_workspace_fk;
alter table public.posts add constraint posts_account_workspace_fk foreign key(workspace_id,social_account_id) references public.social_accounts(workspace_id,id) on delete set null (social_account_id);
alter table public.posts drop constraint if exists posts_media_workspace_fk;
alter table public.posts add constraint posts_media_workspace_fk foreign key(workspace_id,media_id) references public.media(workspace_id,id) on delete set null (media_id);
alter table public.tasks drop constraint if exists tasks_account_workspace_fk;
alter table public.tasks add constraint tasks_account_workspace_fk foreign key(workspace_id,social_account_id) references public.social_accounts(workspace_id,id) on delete set null (social_account_id);
alter table public.tasks drop constraint if exists tasks_post_workspace_fk;
alter table public.tasks add constraint tasks_post_workspace_fk foreign key(workspace_id,post_id) references public.posts(workspace_id,id) on delete set null (post_id);
alter table public.media_account_links drop constraint if exists media_account_workspace_fk;
alter table public.media_account_links add constraint media_account_workspace_fk foreign key(workspace_id,social_account_id) references public.social_accounts(workspace_id,id) on delete cascade;
alter table public.media_account_links drop constraint if exists media_link_media_workspace_fk;
alter table public.media_account_links add constraint media_link_media_workspace_fk foreign key(workspace_id,media_id) references public.media(workspace_id,id) on delete cascade;

create or replace function public.trafficflow_import_v1(p_workspace_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  old_id text;
  new_id integer;
  assistant_item jsonb;
  media_item jsonb;
  account_map jsonb := '{}'::jsonb;
  media_map jsonb := '{}'::jsonb;
  account_count integer := 0;
  media_count integer := 0;
  post_count integer := 0;
  prior public.legacy_imports%rowtype;
  receipt jsonb;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_legacy_payload' using errcode='22023'; end if;
  select * into prior from public.legacy_imports where workspace_id=p_workspace_id;
  if found then return prior.summary || jsonb_build_object('already_imported',true); end if;
  if jsonb_typeof(coalesce(p_payload->'accounts','[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_payload->'assistants','[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_payload->'media','[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_payload->'posts','[]'::jsonb))<>'array' then raise exception 'invalid_legacy_payload' using errcode='22023'; end if;
  if jsonb_array_length(coalesce(p_payload->'accounts','[]'::jsonb))>1000
    or jsonb_array_length(coalesce(p_payload->'assistants','[]'::jsonb))>1000
    or jsonb_array_length(coalesce(p_payload->'media','[]'::jsonb))>1000
    or jsonb_array_length(coalesce(p_payload->'posts','[]'::jsonb))>5000 then raise exception 'legacy_payload_limit' using errcode='22023'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'accounts','[]'::jsonb)) loop
    old_id:=item->>'id';
    insert into public.social_accounts(workspace_id,platform,handle,display_name,niche,avatar_url,followers,engagement_rate,connection_status,is_active,connected_at,created_by)
    values(p_workspace_id,item->>'platform',item->>'handle',item->>'displayName',coalesce(nullif(item->>'niche',''),'Créateur'),item->>'avatarUrl',greatest(0,coalesce(nullif(item->>'followers','')::integer,0)),greatest(0,coalesce(nullif(item->>'engagementRate','')::numeric,0)),coalesce(nullif(item->>'connectionStatus',''),'pending'),coalesce((item->>'isActive')::boolean,true),coalesce(nullif(item->>'connectedAt','')::timestamptz,now()),(select auth.uid()))
    returning id into new_id;
    account_map:=account_map || jsonb_build_object(old_id,new_id);
    account_count:=account_count+1;
    select value into assistant_item from jsonb_array_elements(coalesce(p_payload->'assistants','[]'::jsonb)) where value->>'socialAccountId'=old_id limit 1;
    insert into public.ai_assistants(workspace_id,social_account_id,tone,language,style,audience,rules,permission,updated_by)
    values(p_workspace_id,new_id,coalesce(assistant_item->>'tone','Authentique'),coalesce(assistant_item->>'language','Français'),coalesce(assistant_item->>'style','Clair, chaleureux et utile'),coalesce(assistant_item->>'audience','Communauté intéressée par la niche'),coalesce(assistant_item->>'rules',''),case when assistant_item->>'permission' in ('suggestions','preparation','automation','replies') then assistant_item->>'permission' else 'suggestions' end,(select auth.uid()));
  end loop;

  for media_item in select value from jsonb_array_elements(coalesce(p_payload->'media','[]'::jsonb)) loop
    old_id:=media_item->>'id';
    insert into public.media(workspace_id,title,media_type,source_url,tags,created_by,created_at)
    values(p_workspace_id,media_item->>'title',case when media_item->>'mediaType'='video' then 'video' else 'image' end,media_item->>'url',coalesce(media_item->>'tags',''),(select auth.uid()),coalesce(nullif(media_item->>'createdAt','')::timestamptz,now())) returning id into new_id;
    media_map:=media_map || jsonb_build_object(old_id,new_id);
    media_count:=media_count+1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'posts','[]'::jsonb)) loop
    insert into public.posts(workspace_id,social_account_id,media_id,title,caption,hashtags,cta,status,scheduled_at,published_at,created_by,created_at,updated_at)
    values(
      p_workspace_id,
      case when account_map ? coalesce(item->>'socialAccountId','') then (account_map->>(item->>'socialAccountId'))::integer else null end,
      case when media_map ? coalesce(item->>'mediaId','') then (media_map->>(item->>'mediaId'))::integer else null end,
      item->>'title',coalesce(item->>'caption',''),coalesce(item->>'hashtags',''),coalesce(item->>'cta',''),
      case when item->>'status' in ('draft','scheduled','published','failed') then item->>'status' else 'draft' end,
      nullif(item->>'scheduledAt','')::timestamptz,nullif(item->>'publishedAt','')::timestamptz,(select auth.uid()),coalesce(nullif(item->>'createdAt','')::timestamptz,now()),coalesce(nullif(item->>'updatedAt','')::timestamptz,now())
    );
    post_count:=post_count+1;
  end loop;

  receipt:=jsonb_build_object('already_imported',false,'accounts',account_count,'media',media_count,'posts',post_count,'sensitive_tokens_imported',false);
  insert into public.legacy_imports(workspace_id,imported_by,summary) values(p_workspace_id,(select auth.uid()),receipt);
  return receipt;
end;
$$;
revoke all on function public.trafficflow_import_v1(uuid,jsonb) from public, anon;
grant execute on function public.trafficflow_import_v1(uuid,jsonb) to authenticated;

-- Schedule is distinct from drafting and requires the schedule permission.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_content')
  and (status<>'scheduled' or private.has_workspace_permission(workspace_id,'schedule'))
  and (social_account_id is null or private.can_access_account(workspace_id,social_account_id,'create_content'))
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using (
  private.has_workspace_permission(workspace_id,'edit_content')
  and (social_account_id is null or private.can_access_account(workspace_id,social_account_id,'edit_content'))
) with check (
  private.has_workspace_permission(workspace_id,'edit_content')
  and (status<>'scheduled' or private.has_workspace_permission(workspace_id,'schedule'))
  and (social_account_id is null or private.can_access_account(workspace_id,social_account_id,'edit_content'))
);

commit;
