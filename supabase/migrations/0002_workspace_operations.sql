begin;

-- This function came from the pre-existing Supabase project scaffold. It is not part of TrafficFlow and must not be callable through PostgREST.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.trafficflow_release_ai_message(uuid)') is not null then
    execute 'revoke all on function public.trafficflow_release_ai_message(uuid) from public, anon, authenticated';
  end if;
end;
$$;

-- A workspace is created server-side (with the caller's verified Supabase identity); clients cannot forge owner_id.
create or replace function public.trafficflow_create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'invalid_workspace_name' using errcode='22023'; end if;
  insert into public.workspaces(name,owner_id) values(trim(p_name),current_user_id) returning id into new_id;
  insert into public.workspace_members(workspace_id,user_id,role,status) values(new_id,current_user_id,'owner','active');
  insert into public.subscriptions(workspace_id,plan_code,status,trial_starts_at,trial_ends_at) values(new_id,'starter','trialing',now(),now()+interval '14 days');
  return new_id;
end;
$$;
revoke all on function public.trafficflow_create_workspace(text) from public, anon;
grant execute on function public.trafficflow_create_workspace(text) to authenticated;

-- Change membership only through a role-checked transaction, never by a broad client UPDATE policy.
create or replace function public.trafficflow_set_member(
  p_workspace_id uuid,p_user_id uuid,p_role text,p_status text,p_permissions jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  seat_cap integer;
  current_va_count integer;
  current_role text;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','manager','va') or p_status not in ('active','suspended') then raise exception 'invalid_member_settings' using errcode='22023'; end if;
  if exists(select 1 from public.workspaces w where w.id=p_workspace_id and w.owner_id=p_user_id) then raise exception 'cannot_change_workspace_owner' using errcode='42501'; end if;
  select wm.role into current_role from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=p_user_id;
  if current_role is null then raise exception 'member_not_found' using errcode='P0002'; end if;
  if p_role='va' and p_status='active' then
    select sp.va_limit into seat_cap from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code where s.workspace_id=p_workspace_id for update of s;
    select count(*)::integer into current_va_count from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.role='va' and wm.status='active' and wm.user_id<>p_user_id;
    if current_va_count>=coalesce(seat_cap,0) then raise exception 'plan_limit:va_members' using errcode='23514'; end if;
  end if;
  update public.workspace_members set role=p_role,status=p_status,permissions=coalesce(p_permissions,'{}'::jsonb) where workspace_id=p_workspace_id and user_id=p_user_id;
end;
$$;
revoke all on function public.trafficflow_set_member(uuid,uuid,text,text,jsonb) from public, anon;
grant execute on function public.trafficflow_set_member(uuid,uuid,text,text,jsonb) to authenticated;

-- Lock the subscription row, then count active VAs plus unexpired invitations to avoid seat-limit races.
create or replace function public.trafficflow_create_invitation(
  p_workspace_id uuid,p_email text,p_role text,p_token_hash text,p_permissions jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  seat_cap integer;
  occupied integer;
  invite_id uuid;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','manager','va') then raise exception 'invalid_role' using errcode='22023'; end if;
  if char_length(trim(coalesce(p_email,'')))<5 or position('@' in p_email)<2 then raise exception 'invalid_email' using errcode='22023'; end if;
  if char_length(coalesce(p_token_hash,''))<>64 then raise exception 'invalid_invitation_token' using errcode='22023'; end if;
  perform 1 from public.subscriptions s where s.workspace_id=p_workspace_id for update;
  if not found then raise exception 'subscription_missing' using errcode='23514'; end if;
  if p_role='va' then
    select sp.va_limit into seat_cap from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code where s.workspace_id=p_workspace_id;
    select
      (select count(*)::integer from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.role='va' and wm.status='active')
      +
      (select count(*)::integer from public.workspace_invitations wi where wi.workspace_id=p_workspace_id and wi.role='va' and wi.accepted_at is null and wi.revoked_at is null and wi.expires_at>now())
      into occupied;
    if coalesce(occupied,0)>=coalesce(seat_cap,0) then raise exception 'plan_limit:va_members' using errcode='23514'; end if;
  end if;
  insert into public.workspace_invitations(workspace_id,email,role,token_hash,permissions,invited_by)
   values(p_workspace_id,lower(trim(p_email)),p_role,p_token_hash,coalesce(p_permissions,'{}'::jsonb),(select auth.uid())) returning id into invite_id;
  insert into public.notifications(workspace_id,user_id,kind,title,body)
   values(p_workspace_id,(select auth.uid()),'invitation','Invitation créée','Lien d’invitation à copier et à envoyer à ' || lower(trim(p_email)) || '.');
  return invite_id;
end;
$$;
revoke all on function public.trafficflow_create_invitation(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.trafficflow_create_invitation(uuid,text,text,text,jsonb) to authenticated;

-- Only workspace owners/admins can insert their own one-time migration receipt. The payload is an aggregate count, not record content.
grant insert on public.legacy_imports to authenticated;
create policy legacy_imports_owner_insert on public.legacy_imports for insert to authenticated
  with check (imported_by=(select auth.uid()) and private.has_workspace_role(workspace_id,array['owner','admin']));

-- Triggers keep update timestamps and store before-images only for content edits.
drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function private.workspace_updated_at();
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function private.workspace_updated_at();
drop trigger if exists assistants_set_updated_at on public.ai_assistants;
create trigger assistants_set_updated_at before update on public.ai_assistants for each row execute function private.workspace_updated_at();
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function private.workspace_updated_at();
drop trigger if exists media_set_updated_at on public.media;
create trigger media_set_updated_at before update on public.media for each row execute function private.workspace_updated_at();
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.workspace_updated_at();
drop trigger if exists workflows_set_updated_at on public.automation_workflows;
create trigger workflows_set_updated_at before update on public.automation_workflows for each row execute function private.workspace_updated_at();

create or replace function private.enforce_automation_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  enabled_count integer;
begin
  if not new.enabled then return new; end if;
  if not private.has_workspace_permission(new.workspace_id,'manage_tasks') then raise exception 'permission_denied' using errcode='42501'; end if;
  perform 1 from public.subscriptions s where s.workspace_id=new.workspace_id for update;
  select sp.automation_limit into cap from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code where s.workspace_id=new.workspace_id;
  select count(*)::integer into enabled_count from public.automation_workflows w
   where w.workspace_id=new.workspace_id and w.enabled=true and (tg_op='INSERT' or w.id<>new.id);
  if enabled_count>=coalesce(cap,0) then raise exception 'plan_limit:automations' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_automation_limit() from public, anon, authenticated;
drop trigger if exists automation_limit_guard on public.automation_workflows;
create trigger automation_limit_guard before insert or update of enabled on public.automation_workflows
for each row execute function private.enforce_automation_limit();

create or replace function public.trafficflow_get_my_workspaces()
returns table(workspace_id uuid,workspace_name text,role text,member_status text,subscription_status text,plan_code text,trial_ends_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select w.id,w.name,wm.role,wm.status,s.status,s.plan_code,s.trial_ends_at
  from public.workspace_members wm
  join public.workspaces w on w.id=wm.workspace_id
  left join public.subscriptions s on s.workspace_id=w.id
  where wm.user_id=(select auth.uid()) and wm.status='active'
  order by w.created_at asc
$$;
revoke all on function public.trafficflow_get_my_workspaces() from public, anon;
grant execute on function public.trafficflow_get_my_workspaces() to authenticated;

commit;
