begin;

create or replace function public.trafficflow_touch_membership()
returns void language sql security definer set search_path = '' as $$
  update public.workspace_members set last_active_at=now()
  where user_id=(select auth.uid()) and status='active';
$$;
revoke all on function public.trafficflow_touch_membership() from public,anon;
grant execute on function public.trafficflow_touch_membership() to authenticated;

create or replace function public.trafficflow_update_member_role(p_workspace_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_status text; current_permissions jsonb;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','manager','va') then raise exception 'invalid_role' using errcode='22023'; end if;
  select status,permissions into current_status,current_permissions from public.workspace_members
    where workspace_id=p_workspace_id and user_id=p_user_id;
  if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
  if exists(select 1 from public.workspaces where id=p_workspace_id and owner_id=p_user_id) then raise exception 'cannot_change_workspace_owner' using errcode='42501'; end if;
  perform public.trafficflow_set_member(p_workspace_id,p_user_id,p_role,
    case when current_status='active' then 'active' else 'suspended' end,
    coalesce(current_permissions,'{}'::jsonb));
end;
$$;
revoke all on function public.trafficflow_update_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.trafficflow_update_member_role(uuid,uuid,text) to authenticated;

commit;
