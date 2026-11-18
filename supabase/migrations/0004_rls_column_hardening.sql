begin;

-- Keep tenant identifiers and ownership fields immutable for browser clients.
revoke update on public.social_accounts from authenticated;
grant update(platform,handle,display_name,niche,avatar_url,followers,engagement_rate,is_active) on public.social_accounts to authenticated;
revoke update on public.ai_assistants from authenticated;
grant update(tone,language,style,audience,rules,updated_at) on public.ai_assistants to authenticated;
revoke insert,update,delete on public.account_assignments from authenticated;
grant select on public.account_assignments to authenticated;
revoke update on public.media from authenticated;
grant update(title,media_type,source_url,tags,folder_id,updated_at) on public.media to authenticated;
revoke update on public.posts from authenticated;
grant update(social_account_id,media_id,title,caption,hashtags,cta,status,scheduled_at,published_at,assigned_to,updated_at) on public.posts to authenticated;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke update on public.tasks from authenticated;
revoke insert,update,delete on public.automation_workflows from authenticated;
grant select on public.automation_workflows to authenticated;

create or replace function public.trafficflow_save_assistant(
 p_workspace_id uuid,p_social_account_id integer,p_tone text,p_language text,p_style text,p_audience text,p_rules text,p_permission text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin','manager']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.social_accounts sa where sa.id=p_social_account_id and sa.workspace_id=p_workspace_id) then raise exception 'account_not_found' using errcode='P0002'; end if;
  if p_permission not in ('suggestions','preparation','automation','replies') then raise exception 'invalid_assistant_permission' using errcode='22023'; end if;
  insert into public.ai_assistants(workspace_id,social_account_id,tone,language,style,audience,rules,permission,updated_by)
    values(p_workspace_id,p_social_account_id,left(p_tone,80),left(p_language,48),left(p_style,160),left(p_audience,255),left(coalesce(p_rules,''),4000),p_permission,(select auth.uid()))
    on conflict(social_account_id) do update set tone=excluded.tone,language=excluded.language,style=excluded.style,audience=excluded.audience,rules=excluded.rules,permission=excluded.permission,updated_by=excluded.updated_by,updated_at=now()
    where public.ai_assistants.workspace_id=p_workspace_id;
end;
$$;
revoke all on function public.trafficflow_save_assistant(uuid,integer,text,text,text,text,text,text) from public, anon;
grant execute on function public.trafficflow_save_assistant(uuid,integer,text,text,text,text,text,text) to authenticated;

create or replace function public.trafficflow_create_task(
 p_workspace_id uuid,p_title text,p_description text,p_assigned_to uuid,p_social_account_id integer,p_post_id integer,p_due_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not private.has_workspace_permission(p_workspace_id,'manage_tasks') then raise exception 'permission_denied' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'invalid_task_title' using errcode='22023'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=p_assigned_to and wm.status='active') then raise exception 'assignee_not_in_workspace' using errcode='22023'; end if;
  if p_social_account_id is not null and not exists(select 1 from public.social_accounts sa where sa.id=p_social_account_id and sa.workspace_id=p_workspace_id) then raise exception 'account_not_found' using errcode='P0002'; end if;
  if p_post_id is not null and not exists(select 1 from public.posts p where p.id=p_post_id and p.workspace_id=p_workspace_id) then raise exception 'post_not_found' using errcode='P0002'; end if;
  insert into public.tasks(workspace_id,title,description,assigned_to,social_account_id,post_id,due_at,created_by)
    values(p_workspace_id,left(trim(p_title),200),left(coalesce(p_description,''),5000),p_assigned_to,p_social_account_id,p_post_id,p_due_at,(select auth.uid())) returning id into new_id;
  if p_assigned_to is not null then
    insert into public.notifications(workspace_id,user_id,kind,title,body)
      values(p_workspace_id,p_assigned_to,'task_assigned','Nouvelle tâche',left(trim(p_title),200));
  end if;
  return new_id;
end;
$$;
revoke all on function public.trafficflow_create_task(uuid,text,text,uuid,integer,integer,timestamptz) from public, anon;
grant execute on function public.trafficflow_create_task(uuid,text,text,uuid,integer,integer,timestamptz) to authenticated;

create or replace function public.trafficflow_update_task_status(p_workspace_id uuid,p_task_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.tasks%rowtype;
begin
  if p_status not in ('todo','in_progress','done','canceled') then raise exception 'invalid_task_status' using errcode='22023'; end if;
  select * into target from public.tasks t where t.id=p_task_id and t.workspace_id=p_workspace_id for update;
  if not found then raise exception 'task_not_found' using errcode='P0002'; end if;
  if not (private.has_workspace_permission(p_workspace_id,'manage_tasks') or target.assigned_to=(select auth.uid())) then raise exception 'permission_denied' using errcode='42501'; end if;
  update public.tasks set status=p_status,completed_at=case when p_status='done' then now() else null end where id=p_task_id;
  if p_status='done' then
    insert into public.notifications(workspace_id,user_id,kind,title,body)
      select p_workspace_id,w.owner_id,'task_completed','Tâche terminée',target.title from public.workspaces w where w.id=p_workspace_id;
  end if;
end;
$$;
revoke all on function public.trafficflow_update_task_status(uuid,uuid,text) from public, anon;
grant execute on function public.trafficflow_update_task_status(uuid,uuid,text) to authenticated;

create or replace function public.trafficflow_update_workflow(p_workspace_id uuid,p_workflow_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_workspace_permission(p_workspace_id,'manage_tasks') then raise exception 'permission_denied' using errcode='42501'; end if;
  update public.automation_workflows set enabled=p_enabled,created_by=coalesce(created_by,(select auth.uid()))
   where id=p_workflow_id and workspace_id=p_workspace_id;
  if not found then raise exception 'workflow_not_found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.trafficflow_update_workflow(uuid,uuid,boolean) from public, anon;
grant execute on function public.trafficflow_update_workflow(uuid,uuid,boolean) to authenticated;

commit;
