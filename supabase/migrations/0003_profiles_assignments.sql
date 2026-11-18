begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy profiles_read_workspace_members on public.profiles for select to authenticated using (
  id=(select auth.uid()) or exists (
    select 1 from public.workspace_members target
    join public.workspace_members viewer on viewer.workspace_id=target.workspace_id
    where target.user_id=profiles.id and target.status='active'
      and viewer.user_id=(select auth.uid()) and viewer.status='active'
  )
);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Mon espace');
  insert into public.profiles(id,full_name,email) values(new.id,display_name,coalesce(new.email,''))
    on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,updated_at=now();
  insert into public.workspaces(name, owner_id) values (left(display_name || ' · Studio', 100), new.id) returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role, status) values (new_workspace_id, new.id, 'owner', 'active');
  insert into public.subscriptions(workspace_id, plan_code, status, trial_starts_at, trial_ends_at) values (new_workspace_id, 'starter', 'trialing', now(), now() + interval '14 days');
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Prevent clients from transferring workspace ownership through a general UPDATE.
revoke update on public.workspaces from authenticated;
grant update(name) on public.workspaces to authenticated;
revoke insert, update on public.workspace_members from authenticated;
revoke update on public.subscription_plans from authenticated;
revoke insert, update on public.subscriptions from authenticated;
revoke insert, update, delete on public.social_platforms from authenticated;

create or replace function public.trafficflow_set_assignment(
 p_workspace_id uuid,p_social_account_id integer,p_user_id uuid,p_permissions jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin','manager']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.social_accounts sa where sa.id=p_social_account_id and sa.workspace_id=p_workspace_id) then raise exception 'account_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=p_user_id and wm.role='va' and wm.status='active') then raise exception 'active_va_not_found' using errcode='P0002'; end if;
  if jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' then raise exception 'invalid_permissions' using errcode='22023'; end if;
  insert into public.account_assignments(workspace_id,social_account_id,user_id,permissions,assigned_by)
   values(p_workspace_id,p_social_account_id,p_user_id,coalesce(p_permissions,'{}'::jsonb),(select auth.uid()))
   on conflict(social_account_id,user_id) do update set permissions=excluded.permissions,assigned_by=excluded.assigned_by,workspace_id=excluded.workspace_id;
end;
$$;
revoke all on function public.trafficflow_set_assignment(uuid,integer,uuid,jsonb) from public, anon;
grant execute on function public.trafficflow_set_assignment(uuid,integer,uuid,jsonb) to authenticated;

create or replace function public.trafficflow_delete_assignment(p_workspace_id uuid,p_social_account_id integer,p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin','manager']) then raise exception 'permission_denied' using errcode='42501'; end if;
  delete from public.account_assignments where workspace_id=p_workspace_id and social_account_id=p_social_account_id and user_id=p_user_id;
end;
$$;
revoke all on function public.trafficflow_delete_assignment(uuid,integer,uuid) from public, anon;
grant execute on function public.trafficflow_delete_assignment(uuid,integer,uuid) to authenticated;

commit;
