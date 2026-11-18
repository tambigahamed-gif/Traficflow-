begin;

-- This corrective migration must run after the V2 base schema. It fails closed
-- rather than installing a misleading RPC over missing or incomplete tables.
do $$
begin
  if to_regclass('public.workspaces') is null
     or to_regclass('public.workspace_members') is null
     or to_regclass('public.subscriptions') is null then
    raise exception 'TrafficFlow V2 base tables are missing; apply migrations 0001_trafficflow_v2.sql and 0002_workspace_operations.sql first.'
      using errcode = '55000';
  end if;
  if to_regprocedure('public.trafficflow_create_workspace(text)') is null then
    raise exception 'TrafficFlow workspace creation RPC is missing; apply migration 0002_workspace_operations.sql first.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.trafficflow_get_my_workspaces()
returns table(
  workspace_id uuid,
  workspace_name text,
  role text,
  member_status text,
  subscription_status text,
  plan_code text,
  trial_ends_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id,
    w.name,
    wm.role,
    wm.status,
    s.status,
    s.plan_code,
    s.trial_ends_at
  from public.workspace_members as wm
  join public.workspaces as w on w.id = wm.workspace_id
  left join public.subscriptions as s on s.workspace_id = w.id
  where wm.user_id = (select auth.uid())
    and wm.status = 'active'
  order by w.created_at asc;
$$;

-- Caller privileges preserve the existing RLS policies. Only authenticated
-- users can invoke this RPC; anonymous and PUBLIC execution are revoked.
revoke all on function public.trafficflow_get_my_workspaces() from public, anon, authenticated;
grant execute on function public.trafficflow_get_my_workspaces() to authenticated;

-- Registration provisioning is owned by migration 0001. Fail rather than
-- claiming signup is ready when its trigger/function is absent or disabled.
do $$
begin
  if to_regprocedure('public.trafficflow_create_workspace(text)') is null then
    raise exception 'TrafficFlow workspace creation RPC is missing; apply migration 0002_workspace_operations.sql first.'
      using errcode = '55000';
  end if;

  if to_regprocedure('private.handle_new_user()') is null then
    raise exception 'TrafficFlow signup trigger function is missing; apply migration 0001_trafficflow_v2.sql first.'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created_trafficflow'
      and p.oid = to_regprocedure('private.handle_new_user()')
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
  ) then
    raise exception 'TrafficFlow signup trigger is missing or disabled; reapply migration 0001_trafficflow_v2.sql before this repair.'
      using errcode = '55000';
  end if;
end;
$$;

-- Let PostgREST discover the replaced function signature immediately.
notify pgrst, 'reload schema';

commit;
