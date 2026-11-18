-- TrafficFlow migration 0014: Business-tier pre-scheduling approval workflow.
-- Additive and non-destructive. Do not re-run migrations 0001-0013; this file is not
-- applied to any database by the build/package workflow.
begin;

create table if not exists public.post_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id integer references public.posts(id) on delete set null,
  post_snapshot jsonb not null check (jsonb_typeof(post_snapshot) = 'object'),
  requested_scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  request_note text not null default '',
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((status = 'pending' and decided_at is null and decided_by is null) or (status <> 'pending' and decided_at is not null))
);
create index if not exists post_approval_requests_workspace_queue_idx
  on public.post_approval_requests(workspace_id, status, created_at desc);
create index if not exists post_approval_requests_post_history_idx
  on public.post_approval_requests(workspace_id, post_id, created_at desc);
create unique index if not exists post_approval_requests_one_pending_per_post_idx
  on public.post_approval_requests(workspace_id, post_id) where status = 'pending' and post_id is not null;

alter table public.post_approval_requests enable row level security;
revoke all on public.post_approval_requests from public, anon, authenticated;
grant select on public.post_approval_requests to authenticated;
drop policy if exists post_approval_requests_read on public.post_approval_requests;
create policy post_approval_requests_read on public.post_approval_requests
  for select to authenticated
  using (
    private.has_workspace_role(workspace_id, array['owner','admin'])
    or (
      post_id is not null
      and exists (
        select 1 from public.posts post
        where post.id = post_approval_requests.post_id
          and post.workspace_id = post_approval_requests.workspace_id
          and (post.social_account_id is null or private.can_access_account(post.workspace_id, post.social_account_id, 'view_content'))
      )
    )
    or (requested_by = (select auth.uid()) and private.has_workspace_role(workspace_id, null))
  );

create or replace function private.workspace_uses_post_approval(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((private.effective_plan(p_workspace_id)).code = 'business', false);
$$;
revoke all on function private.workspace_uses_post_approval(uuid) from public, anon, authenticated;

create or replace function private.enforce_post_approval_before_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  latest_status text;
  latest_schedule timestamptz;
  latest_snapshot jsonb;
begin
  if new.status <> 'scheduled' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'scheduled'
       and old.scheduled_at is not distinct from new.scheduled_at
       and old.title is not distinct from new.title
       and old.caption is not distinct from new.caption
       and old.hashtags is not distinct from new.hashtags
       and old.cta is not distinct from new.cta
       and old.social_account_id is not distinct from new.social_account_id
       and old.media_id is not distinct from new.media_id then return new; end if;
  end if;
  if not private.workspace_uses_post_approval(new.workspace_id) then return new; end if;

  select request.status, request.requested_scheduled_at, request.post_snapshot
    into latest_status, latest_schedule, latest_snapshot
    from public.post_approval_requests request
    where request.workspace_id = new.workspace_id and request.post_id = new.id
    order by request.created_at desc, request.id desc
    limit 1;

  if latest_status is distinct from 'approved'
     or latest_schedule is distinct from new.scheduled_at
     or latest_snapshot is distinct from jsonb_build_object(
       'title', new.title,
       'caption', new.caption,
       'hashtags', new.hashtags,
       'cta', new.cta,
       'social_account_id', new.social_account_id,
       'media_id', new.media_id
     ) then
    raise exception 'approval_required:business_schedule' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_post_approval_before_schedule() from public, anon, authenticated;
drop trigger if exists posts_business_approval_guard on public.posts;
create trigger posts_business_approval_guard
  before insert or update on public.posts
  for each row execute function private.enforce_post_approval_before_schedule();

create or replace function public.trafficflow_submit_post_for_approval(
  p_workspace_id uuid,
  p_post_id integer,
  p_scheduled_at timestamptz,
  p_request_note text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  target public.posts%rowtype;
  request_id uuid;
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not private.has_workspace_permission(p_workspace_id, 'edit_content')
     or not private.has_workspace_permission(p_workspace_id, 'schedule') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not private.workspace_uses_post_approval(p_workspace_id) then raise exception 'business_plan_required' using errcode = '42501'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then raise exception 'scheduled_at_must_be_future' using errcode = '22023'; end if;

  select * into target from public.posts post
    where post.id = p_post_id and post.workspace_id = p_workspace_id
    for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  if target.status <> 'draft' then raise exception 'post_must_be_draft' using errcode = '22023'; end if;
  if target.social_account_id is not null
     and not private.can_access_account(p_workspace_id, target.social_account_id, 'schedule') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  insert into public.post_approval_requests(
    workspace_id, post_id, post_snapshot, requested_scheduled_at, requested_by, request_note
  ) values (
    p_workspace_id,
    p_post_id,
    jsonb_build_object(
      'title', target.title,
      'caption', target.caption,
      'hashtags', target.hashtags,
      'cta', target.cta,
      'social_account_id', target.social_account_id,
      'media_id', target.media_id
    ),
    p_scheduled_at,
    current_user_id,
    left(coalesce(p_request_note, ''), 2000)
  ) returning id into request_id;

  insert into public.notifications(workspace_id, user_id, kind, title, body, href)
    select p_workspace_id, member.user_id, 'system', 'Contenu à approuver',
      'Une demande pour « ' || left(target.title, 120) || ' » attend une décision avant programmation.', '/business'
    from public.workspace_members member
    where member.workspace_id = p_workspace_id
      and member.status = 'active'
      and member.role in ('owner','admin','manager')
      and member.user_id <> current_user_id;

  return request_id;
end;
$$;
revoke all on function public.trafficflow_submit_post_for_approval(uuid, integer, timestamptz, text) from public, anon;
grant execute on function public.trafficflow_submit_post_for_approval(uuid, integer, timestamptz, text) to authenticated;

create or replace function public.trafficflow_decide_post_approval(
  p_workspace_id uuid,
  p_request_id uuid,
  p_decision text,
  p_decision_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  request_row public.post_approval_requests%rowtype;
  post_row public.posts%rowtype;
  changed_count integer;
begin
  if current_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not private.has_workspace_role(p_workspace_id, array['owner','admin','manager']) then raise exception 'permission_denied' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  if not private.workspace_uses_post_approval(p_workspace_id) then raise exception 'business_plan_required' using errcode = '42501'; end if;

  select * into request_row from public.post_approval_requests request
    where request.id = p_request_id and request.workspace_id = p_workspace_id
    for update;
  if not found then raise exception 'approval_request_not_found' using errcode = 'P0002'; end if;
  if request_row.status <> 'pending' then raise exception 'approval_request_already_decided' using errcode = '22023'; end if;
  if request_row.requested_by = current_user_id then raise exception 'requester_cannot_approve_own_post' using errcode = '42501'; end if;
  if p_decision = 'rejected' and request_row.post_id is not null then
    select post.social_account_id into post_row.social_account_id
      from public.posts post
      where post.id = request_row.post_id and post.workspace_id = p_workspace_id;
    if post_row.social_account_id is not null
       and not private.can_access_account(p_workspace_id, post_row.social_account_id, 'view_content') then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
  end if;
  if p_decision = 'approved' then
    if request_row.post_id is null or request_row.requested_scheduled_at <= now() then
      raise exception 'approval_request_post_or_schedule_unavailable' using errcode = '22023';
    end if;
    select * into post_row from public.posts post
      where post.id = request_row.post_id and post.workspace_id = p_workspace_id
      for update;
    if not found or post_row.status <> 'draft' then raise exception 'approval_post_unavailable' using errcode = 'P0002'; end if;
    if post_row.social_account_id is not null
       and not private.can_access_account(p_workspace_id, post_row.social_account_id, 'schedule') then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
    if request_row.post_snapshot <> jsonb_build_object(
      'title', post_row.title,
      'caption', post_row.caption,
      'hashtags', post_row.hashtags,
      'cta', post_row.cta,
      'social_account_id', post_row.social_account_id,
      'media_id', post_row.media_id
    ) then raise exception 'approval_post_changed_since_submission' using errcode = '22023'; end if;
  end if;

  update public.post_approval_requests
    set status = p_decision,
        decided_by = current_user_id,
        decision_note = left(coalesce(p_decision_note, ''), 2000),
        decided_at = now()
    where id = p_request_id and workspace_id = p_workspace_id;

  if p_decision = 'approved' then
    update public.posts
      set status = 'scheduled', scheduled_at = request_row.requested_scheduled_at, updated_at = now()
      where id = request_row.post_id and workspace_id = p_workspace_id and status = 'draft';
    get diagnostics changed_count = row_count;
    if changed_count <> 1 then raise exception 'approval_post_unavailable' using errcode = 'P0002'; end if;
  end if;

  if request_row.requested_by is not null and request_row.requested_by <> current_user_id then
    insert into public.notifications(workspace_id, user_id, kind, title, body, href)
      values (
        p_workspace_id,
        request_row.requested_by,
        'system',
        case when p_decision = 'approved' then 'Contenu approuvé' else 'Demande refusée' end,
        (case when p_decision = 'approved'
          then 'Votre contenu a été approuvé et ajouté au calendrier TrafficFlow.'
          else 'Votre demande de programmation a été refusée.' end)
          || case when coalesce(p_decision_note, '') = '' then '' else ' Note : ' || left(p_decision_note, 500) end,
        '/business'
      );
  end if;
end;
$$;
revoke all on function public.trafficflow_decide_post_approval(uuid, uuid, text, text) from public, anon;
grant execute on function public.trafficflow_decide_post_approval(uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
