begin;

-- Rôle global de plateforme, distinct des rôles propres aux Workspaces.
-- Aucun INSERT/UPDATE/DELETE n'est accordé aux clients authenticated.
create table if not exists public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role = 'super_admin'),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists platform_roles_active_idx
  on public.platform_roles(role, revoked_at)
  where revoked_at is null;

alter table public.platform_roles enable row level security;
revoke all on public.platform_roles from public, anon, authenticated;
grant select on public.platform_roles to authenticated;

create policy platform_roles_read_self
  on public.platform_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and role = 'super_admin'
    and revoked_at is null
  );

-- Fonction utilisée par les futures policies RLS administratives.
-- Elle ne prend jamais un user_id fourni par le client.
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_roles
    where user_id = (select auth.uid())
      and role = 'super_admin'
      and revoked_at is null
  );
$$;

revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.is_super_admin() to authenticated;

-- Attribution initiale explicite : appelable uniquement avec la clé service_role.
-- Cette fonction n'est pas exposée aux utilisateurs authentifiés.
create or replace function public.trafficflow_grant_super_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'auth_user_not_found' using errcode = 'P0002';
  end if;

  insert into public.platform_roles(user_id, role, granted_by)
  values (p_user_id, 'super_admin', null)
  on conflict (user_id) do update
    set role = 'super_admin', revoked_at = null;
end;
$$;

revoke all on function public.trafficflow_grant_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.trafficflow_grant_super_admin(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
