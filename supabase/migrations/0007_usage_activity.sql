begin;

create or replace function public.trafficflow_get_usage(p_workspace_id uuid)
returns table(
 plan_code text,plan_name text,price_usd numeric,subscription_status text,trial_ends_at timestamptz,renews_at timestamptz,
 social_account_limit integer,va_limit integer,ai_message_limit integer,automation_limit integer,advanced_analytics boolean,priority_support boolean,
 social_accounts_used bigint,vas_used bigint,automations_used bigint,ai_messages_used integer,period_start date,can_manage_billing boolean
) language sql stable security definer set search_path = '' as $$
 select sp.code,sp.name,sp.price_usd,s.status,s.trial_ends_at,s.renews_at,
        sp.social_account_limit,sp.va_limit,sp.ai_message_limit,sp.automation_limit,sp.advanced_analytics,sp.priority_support,
        (select count(*) from public.social_accounts sa where sa.workspace_id=p_workspace_id),
        (select count(*) from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.role='va' and wm.status='active'),
        (select count(*) from public.automation_workflows aw where aw.workspace_id=p_workspace_id and aw.enabled),
        coalesce((select au.messages_used from public.ai_usage au where au.workspace_id=p_workspace_id and au.period_start=date_trunc('month',now() at time zone 'UTC')::date),0),
        date_trunc('month',now() at time zone 'UTC')::date,
        private.has_workspace_role(p_workspace_id,array['owner','admin'])
 from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code
 where s.workspace_id=p_workspace_id and private.has_workspace_role(p_workspace_id,null)
$$;
revoke all on function public.trafficflow_get_usage(uuid) from public,anon;
grant execute on function public.trafficflow_get_usage(uuid) to authenticated;

create or replace function public.trafficflow_touch_membership()
returns void language sql security definer set search_path = '' as $$
  update public.workspace_members set last_active_at=now()
  where user_id=(select auth.uid()) and status='active';
$$;
revoke all on function public.trafficflow_touch_membership() from public,anon;
grant execute on function public.trafficflow_touch_membership() to authenticated;

create or replace function public.trafficflow_get_invitation_by_token(p_token text)
returns table(workspace_name text,invite_email text,invite_role text,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.name,wi.email,wi.role,wi.expires_at
  from public.workspace_invitations wi join public.workspaces w on w.id=wi.workspace_id
  where wi.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and wi.accepted_at is null and wi.revoked_at is null and wi.expires_at>now()
    and lower(wi.email)=lower(coalesce((select auth.jwt()->>'email'),''))
$$;
revoke all on function public.trafficflow_get_invitation_by_token(text) from public,anon;
grant execute on function public.trafficflow_get_invitation_by_token(text) to authenticated;

create or replace function public.trafficflow_create_social_account(
  p_workspace_id uuid,p_platform text,p_handle text,p_display_name text,p_niche text default 'Créateur'
) returns integer language plpgsql security definer set search_path = '' as $$
declare cap integer; current_count integer; new_id integer;
begin
  if not private.has_workspace_permission(p_workspace_id,'manage_social_accounts') then raise exception 'permission_denied' using errcode='42501'; end if;
  perform 1 from public.subscriptions where workspace_id=p_workspace_id for update;
  select sp.social_account_limit into cap from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code where s.workspace_id=p_workspace_id;
  if cap is null then raise exception 'subscription_missing' using errcode='23514'; end if;
  select count(*)::integer into current_count from public.social_accounts where workspace_id=p_workspace_id;
  if current_count>=cap then raise exception 'plan_limit:social_accounts' using errcode='23514'; end if;
  if p_platform not in ('Instagram','TikTok','X','YouTube','Facebook','LinkedIn','Messenger') then raise exception 'invalid_platform' using errcode='22023'; end if;
  insert into public.social_accounts(workspace_id,platform,handle,display_name,niche,connection_status,created_by)
   values(p_workspace_id,p_platform,left(trim(p_handle),120),left(trim(p_display_name),160),left(coalesce(p_niche,'Créateur'),120),'pending',(select auth.uid())) returning id into new_id;
  insert into public.ai_assistants(workspace_id,social_account_id,updated_by) values(p_workspace_id,new_id,(select auth.uid()));
  return new_id;
end;
$$;
revoke all on function public.trafficflow_create_social_account(uuid,text,text,text,text) from public,anon;
grant execute on function public.trafficflow_create_social_account(uuid,text,text,text,text) to authenticated;

create or replace function public.trafficflow_update_member_role(p_workspace_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_status text; current_permissions jsonb;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','manager','va') then raise exception 'invalid_role' using errcode='22023'; end if;
  select status,permissions into current_status,current_permissions from public.workspace_members where workspace_id=p_workspace_id and user_id=p_user_id;
  if not found then raise exception 'member_not_found' using errcode='P0002'; end if;
  perform public.trafficflow_set_member(p_workspace_id,p_user_id,p_role,case when current_status='active' then 'active' else 'suspended' end,coalesce(current_permissions,'{}'::jsonb));
end;
$$;
revoke all on function public.trafficflow_update_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.trafficflow_update_member_role(uuid,uuid,text) to authenticated;

commit;
