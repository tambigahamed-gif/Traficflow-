-- 0012 — Forfaits Free/Standard/Pro/Business, essai 7 jours, limites serveur, facturation.
-- Additive : les forfaits historiques (starter, enterprise) sont conservés mais masqués.
-- Aucune donnée n'est supprimée. Procédure de retour : supabase/migrations_down/0012_down.sql
begin;

-- 1. Plans -------------------------------------------------------------------
alter table public.subscription_plans drop constraint if exists subscription_plans_code_check;
alter table public.subscription_plans
  add constraint subscription_plans_code_check check (code ~ '^[a-z][a-z0-9_]{1,31}$'),
  add column if not exists member_limit integer check (member_limit is null or member_limit > 0),
  add column if not exists link_page_limit integer check (link_page_limit is null or link_page_limit >= 0), -- null = illimité
  add column if not exists scheduled_post_limit integer check (scheduled_post_limit is null or scheduled_post_limit >= 0),
  add column if not exists is_public boolean not null default true,
  add column if not exists team_analytics boolean not null default false,
  add column if not exists sort_order integer not null default 100;

alter table public.subscription_plans alter column social_account_limit drop not null;
alter table public.subscription_plans drop constraint if exists subscription_plans_social_account_limit_check;
alter table public.subscription_plans add constraint subscription_plans_social_account_limit_check check (social_account_limit is null or social_account_limit > 0);

insert into public.subscription_plans
  (code,name,price_usd,social_account_limit,va_limit,member_limit,link_page_limit,scheduled_post_limit,ai_message_limit,automation_limit,advanced_analytics,team_analytics,priority_support,is_public,sort_order) values
  ('free',     'Free',     0,   3,   0, 1,  1,    20,   20,   0,   false,false,false,true,10),
  ('standard', 'Standard', 9,   10,  2, 3,  5,    100,  250,  5,   false,false,false,true,20),
  ('pro',      'Pro',      29,  50,  9, 10, 20,   500,  750,  25,  true, false,true, true,30),
  ('business', 'Business', 99,  150, 29,30, null, 2000, 2000, 100, true, true, true, true,40)
on conflict (code) do update set name=excluded.name, price_usd=excluded.price_usd, social_account_limit=excluded.social_account_limit,
  va_limit=excluded.va_limit, member_limit=excluded.member_limit, link_page_limit=excluded.link_page_limit,
  scheduled_post_limit=excluded.scheduled_post_limit, ai_message_limit=excluded.ai_message_limit, automation_limit=excluded.automation_limit,
  advanced_analytics=excluded.advanced_analytics, team_analytics=excluded.team_analytics, priority_support=excluded.priority_support,
  is_public=excluded.is_public, sort_order=excluded.sort_order;

-- Forfaits historiques : conservés pour les abonnements existants, non proposés.
update public.subscription_plans set is_public=false, member_limit=coalesce(member_limit,va_limit+1), link_page_limit=coalesce(link_page_limit,1),
  scheduled_post_limit=coalesce(scheduled_post_limit,100), sort_order=900 where code='starter';
update public.subscription_plans set is_public=false, member_limit=coalesce(member_limit,va_limit+1), link_page_limit=null,
  scheduled_post_limit=coalesce(scheduled_post_limit,2000), sort_order=910 where code='enterprise';

-- 2. Abonnements ------------------------------------------------------------
alter table public.subscriptions
  add column if not exists grace_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz;
alter table public.subscriptions alter column trial_ends_at set default (now() + interval '7 days');

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Mon espace');
  insert into public.workspaces(name, owner_id) values (left(display_name || ' · Studio', 100), new.id) returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role, status) values (new_workspace_id, new.id, 'owner', 'active');
  insert into public.subscriptions(workspace_id, plan_code, status, trial_starts_at, trial_ends_at)
    values (new_workspace_id, 'free', 'trialing', now(), now() + interval '7 days');
  insert into public.subscription_events(workspace_id,event_type,to_plan,note) values (new_workspace_id,'trial_started','free','Essai gratuit de 7 jours.');
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Forfait réellement applicable : paiement échoué hors période de grâce, annulation
-- ou expiration => limites Free. Les données ne sont JAMAIS supprimées ; seuls les nouveaux ajouts sont bloqués.
create or replace function private.effective_plan(p_workspace_id uuid)
returns public.subscription_plans language sql stable security definer set search_path = '' as $$
  select sp.* from public.subscription_plans sp
  where sp.code = coalesce((
    select case
      when s.status = 'active' then s.plan_code
      when s.status = 'trialing' and s.trial_ends_at > now() then s.plan_code
      when s.status = 'past_due' and s.grace_ends_at > now() then s.plan_code
      else 'free' end
    from public.subscriptions s where s.workspace_id = p_workspace_id), 'free');
$$;
revoke all on function private.effective_plan(uuid) from public, anon, authenticated;

-- 3. Garde-fous serveur -----------------------------------------------------
create or replace function private.enforce_social_account_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare plan public.subscription_plans; current_count integer;
begin
  perform 1 from public.subscriptions s where s.workspace_id=new.workspace_id for update;
  plan := private.effective_plan(new.workspace_id);
  if plan.code is null then raise exception 'subscription_missing' using errcode='23514'; end if;
  select count(*)::integer into current_count from public.social_accounts sa
    where sa.workspace_id=new.workspace_id and (tg_op='INSERT' or sa.id<>new.id);
  if plan.social_account_limit is not null and current_count>=plan.social_account_limit then
    raise exception 'plan_limit:social_accounts' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_social_account_limit() from public,anon,authenticated;

create or replace function private.enforce_link_page_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare plan public.subscription_plans; current_count integer;
begin
  perform 1 from public.subscriptions s where s.workspace_id=new.workspace_id for update;
  plan := private.effective_plan(new.workspace_id);
  select count(*)::integer into current_count from public.link_pages lp where lp.workspace_id=new.workspace_id;
  if plan.link_page_limit is not null and current_count>=plan.link_page_limit then
    raise exception 'plan_limit:link_pages' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_link_page_limit() from public,anon,authenticated;
drop trigger if exists link_pages_plan_guard on public.link_pages;
create trigger link_pages_plan_guard before insert on public.link_pages for each row execute function private.enforce_link_page_limit();

create or replace function private.enforce_scheduled_post_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare plan public.subscription_plans; current_count integer;
begin
  if new.status <> 'scheduled' or (tg_op='UPDATE' and old.status='scheduled') then return new; end if;
  perform 1 from public.subscriptions s where s.workspace_id=new.workspace_id for update;
  plan := private.effective_plan(new.workspace_id);
  select count(*)::integer into current_count from public.posts p
    where p.workspace_id=new.workspace_id and p.status='scheduled' and (tg_op='INSERT' or p.id<>new.id);
  if plan.scheduled_post_limit is not null and current_count>=plan.scheduled_post_limit then
    raise exception 'plan_limit:scheduled_posts' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_scheduled_post_limit() from public,anon,authenticated;
drop trigger if exists posts_plan_guard on public.posts;
create trigger posts_plan_guard before insert or update of status on public.posts for each row execute function private.enforce_scheduled_post_limit();

create or replace function public.trafficflow_consume_ai_message(p_workspace_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  plan public.subscription_plans; used integer;
  month_start date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if not private.has_workspace_permission(p_workspace_id,'use_ai') then raise exception 'permission_denied' using errcode='42501'; end if;
  plan := private.effective_plan(p_workspace_id);
  if plan.code is null then raise exception 'subscription_missing' using errcode='23514'; end if;
  insert into public.ai_usage(workspace_id,period_start,messages_used) values(p_workspace_id,month_start,1)
  on conflict(workspace_id,period_start) do update set messages_used=public.ai_usage.messages_used+1,updated_at=now()
  where public.ai_usage.messages_used < plan.ai_message_limit
  returning messages_used into used;
  if used is null then raise exception 'plan_limit:ai_messages' using errcode='23514'; end if;
  return used;
end;
$$;
revoke all on function public.trafficflow_consume_ai_message(uuid) from public, anon;
grant execute on function public.trafficflow_consume_ai_message(uuid) to authenticated;

create or replace function public.trafficflow_create_invitation(
  p_workspace_id uuid,p_email text,p_role text,p_token_hash text,p_permissions jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare plan public.subscription_plans; seats integer; invite_id uuid;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if p_role not in ('admin','manager','va') then raise exception 'invalid_role' using errcode='22023'; end if;
  perform 1 from public.subscriptions s where s.workspace_id=p_workspace_id for update;
  plan := private.effective_plan(p_workspace_id);
  select (select count(*) from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.status='active')
       + (select count(*) from public.workspace_invitations wi where wi.workspace_id=p_workspace_id and wi.accepted_at is null and wi.revoked_at is null and wi.expires_at>now())
    into seats;
  if plan.member_limit is not null and seats>=plan.member_limit then raise exception 'plan_limit:va_members' using errcode='23514'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,token_hash,permissions,invited_by)
   values(p_workspace_id,lower(trim(p_email)),p_role,p_token_hash,coalesce(p_permissions,'{}'::jsonb),(select auth.uid())) returning id into invite_id;
  insert into public.notifications(workspace_id,user_id,kind,title,body)
   select p_workspace_id,(select auth.uid()),'invitation','Invitation créée','Lien à copier et à envoyer à ' || lower(trim(p_email)) || '.';
  return invite_id;
end;
$$;
revoke all on function public.trafficflow_create_invitation(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.trafficflow_create_invitation(uuid,text,text,text,jsonb) to authenticated;

-- 4. Usage lisible par l'interface -----------------------------------------
create or replace function public.trafficflow_get_usage_v3(p_workspace_id uuid)
returns table(
  plan_code text, plan_name text, price_usd numeric, subscription_status text, trial_ends_at timestamptz, renews_at timestamptz,
  grace_ends_at timestamptz, cancel_at_period_end boolean, effective_plan_code text,
  social_account_limit integer, member_limit integer, link_page_limit integer, scheduled_post_limit integer, ai_message_limit integer, automation_limit integer,
  advanced_analytics boolean, team_analytics boolean, priority_support boolean,
  social_accounts_used bigint, members_used bigint, link_pages_used bigint, scheduled_posts_used bigint, automations_used bigint, ai_messages_used integer,
  can_manage_billing boolean
) language sql stable security definer set search_path = '' as $$
  select sp.code, sp.name, sp.price_usd, s.status, s.trial_ends_at, s.renews_at, s.grace_ends_at, s.cancel_at_period_end,
         (private.effective_plan(p_workspace_id)).code,
         ep.social_account_limit, ep.member_limit, ep.link_page_limit, ep.scheduled_post_limit, ep.ai_message_limit, ep.automation_limit,
         ep.advanced_analytics, ep.team_analytics, ep.priority_support,
         (select count(*) from public.social_accounts x where x.workspace_id=p_workspace_id),
         (select count(*) from public.workspace_members x where x.workspace_id=p_workspace_id and x.status='active'),
         (select count(*) from public.link_pages x where x.workspace_id=p_workspace_id),
         (select count(*) from public.posts x where x.workspace_id=p_workspace_id and x.status='scheduled'),
         (select count(*) from public.automation_workflows x where x.workspace_id=p_workspace_id and x.enabled),
         coalesce((select au.messages_used from public.ai_usage au where au.workspace_id=p_workspace_id and au.period_start=date_trunc('month',now() at time zone 'UTC')::date),0),
         private.has_workspace_role(p_workspace_id,array['owner','admin'])
  from public.subscriptions s
  join public.subscription_plans sp on sp.code=s.plan_code
  cross join lateral (select * from private.effective_plan(p_workspace_id)) ep
  where s.workspace_id=p_workspace_id and private.has_workspace_role(p_workspace_id,null)
$$;
revoke all on function public.trafficflow_get_usage_v3(uuid) from public,anon;
grant execute on function public.trafficflow_get_usage_v3(uuid) to authenticated;

-- 5. Paiements --------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  currency text not null default 'USD',
  provider text not null check (provider in ('saspay','binance_pay')),
  reference text not null unique,                         -- référence interne unique envoyée au fournisseur
  provider_transaction_id text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','canceled','expired')),
  failure_reason text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (provider, provider_transaction_id)
);
create index if not exists payment_transactions_workspace_idx on public.payment_transactions(workspace_id, created_at desc);

create table if not exists public.payment_webhook_events (
  id bigint generated by default as identity primary key,
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  unique (provider, event_id)                              -- protège contre les notifications dupliquées
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  number text not null unique,
  plan_code text not null references public.subscription_plans(code),
  amount_usd numeric(10,2) not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  issued_at timestamptz not null default now()
);

alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.invoices enable row level security;
revoke all on public.payment_transactions, public.payment_webhook_events, public.invoices from anon, authenticated;
grant select on public.payment_transactions, public.invoices to authenticated;
create policy payment_transactions_read_owner on public.payment_transactions for select to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy invoices_read_owner on public.invoices for select to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']));
-- payment_webhook_events : aucune policy => inaccessible hors service_role.

-- Création d'une transaction « pending » (montant lu en base, jamais fourni par le client).
create or replace function public.trafficflow_create_payment(p_workspace_id uuid, p_plan_code text, p_provider text)
returns table(transaction_id uuid, reference text, amount_usd numeric)
language plpgsql security definer set search_path = '' as $$
declare plan public.subscription_plans; tx_id uuid; ref text;
begin
  if not private.has_workspace_role(p_workspace_id, array['owner']) then raise exception 'permission_denied' using errcode='42501'; end if;
  select * into plan from public.subscription_plans where code=p_plan_code and is_public and price_usd>0;
  if plan.code is null then raise exception 'invalid_plan' using errcode='22023'; end if;
  if p_provider not in ('saspay','binance_pay') then raise exception 'invalid_provider' using errcode='22023'; end if;
  ref := 'TF-' || upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.payment_transactions(workspace_id,plan_code,amount_usd,provider,reference,created_by)
    values (p_workspace_id,plan.code,plan.price_usd,p_provider,ref,(select auth.uid())) returning id into tx_id;
  insert into public.subscription_events(workspace_id,event_type,from_plan,to_plan,provider,note,created_by)
    select p_workspace_id,'plan_change_requested',s.plan_code,plan.code,p_provider,'Transaction '||ref||' en attente de confirmation du fournisseur.',(select auth.uid())
    from public.subscriptions s where s.workspace_id=p_workspace_id;
  return query select tx_id, ref, plan.price_usd;
end;
$$;
revoke all on function public.trafficflow_create_payment(uuid,text,text) from public,anon;
grant execute on function public.trafficflow_create_payment(uuid,text,text) to authenticated;

-- Confirmation : réservée au serveur (service_role), appelée uniquement après vérification du webhook.
create or replace function public.trafficflow_apply_payment_result(
  p_provider text, p_event_id text, p_reference text, p_provider_transaction_id text, p_amount_usd numeric, p_success boolean, p_reason text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare tx public.payment_transactions; old_plan text; period_end timestamptz := now() + interval '1 month'; inv_no text;
begin
  insert into public.payment_webhook_events(provider,event_id) values (p_provider,p_event_id) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  select * into tx from public.payment_transactions where reference=p_reference and provider=p_provider for update;
  if tx.id is null then update public.payment_webhook_events set processed_at=now(),outcome='unknown_reference' where provider=p_provider and event_id=p_event_id; return 'unknown_reference'; end if;
  if tx.status <> 'pending' then update public.payment_webhook_events set processed_at=now(),outcome='already_final' where provider=p_provider and event_id=p_event_id; return 'already_final'; end if;
  if p_success and p_amount_usd is distinct from tx.amount_usd then
    update public.payment_transactions set status='failed', failure_reason='amount_mismatch' where id=tx.id;
    update public.payment_webhook_events set processed_at=now(),outcome='amount_mismatch' where provider=p_provider and event_id=p_event_id;
    return 'amount_mismatch';
  end if;
  if p_success then
    select plan_code into old_plan from public.subscriptions where workspace_id=tx.workspace_id for update;
    update public.payment_transactions set status='succeeded', provider_transaction_id=p_provider_transaction_id, confirmed_at=now() where id=tx.id;
    update public.subscriptions set plan_code=tx.plan_code, status='active', started_at=now(), renews_at=period_end,
      grace_ends_at=null, cancel_at_period_end=false, canceled_at=null, payment_provider=p_provider, updated_at=now()
      where workspace_id=tx.workspace_id;
    inv_no := 'TF-' || to_char(now(),'YYYYMM') || '-' || substr(tx.id::text,1,8);
    insert into public.invoices(workspace_id,transaction_id,number,plan_code,amount_usd,period_start,period_end)
      values (tx.workspace_id,tx.id,inv_no,tx.plan_code,tx.amount_usd,now(),period_end);
    insert into public.subscription_events(workspace_id,event_type,from_plan,to_plan,provider,external_event_id,note)
      values (tx.workspace_id, case when old_plan=tx.plan_code then 'renewal' else 'plan_changed' end, old_plan, tx.plan_code, p_provider, p_event_id, 'Paiement confirmé.');
  else
    update public.payment_transactions set status='failed', failure_reason=left(coalesce(p_reason,'failed'),200) where id=tx.id;
    update public.subscriptions set status='past_due', grace_ends_at=coalesce(grace_ends_at, now()+interval '7 days'), updated_at=now()
      where workspace_id=tx.workspace_id and status='active';
    insert into public.subscription_events(workspace_id,event_type,provider,external_event_id,note)
      values (tx.workspace_id,'payment_issue',p_provider,p_event_id,'Paiement échoué.');
  end if;
  update public.payment_webhook_events set processed_at=now(),outcome=case when p_success then 'succeeded' else 'failed' end where provider=p_provider and event_id=p_event_id;
  return case when p_success then 'succeeded' else 'failed' end;
end;
$$;
revoke all on function public.trafficflow_apply_payment_result(text,text,text,text,numeric,boolean,text) from public,anon,authenticated;
grant execute on function public.trafficflow_apply_payment_result(text,text,text,text,numeric,boolean,text) to service_role;

create or replace function public.trafficflow_cancel_subscription(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_workspace_role(p_workspace_id, array['owner']) then raise exception 'permission_denied' using errcode='42501'; end if;
  update public.subscriptions set cancel_at_period_end=true, canceled_at=now(), updated_at=now()
    where workspace_id=p_workspace_id and status='active' and plan_code<>'free';
  if not found then raise exception 'no_active_paid_subscription' using errcode='P0002'; end if;
  insert into public.subscription_events(workspace_id,event_type,note,created_by)
    values (p_workspace_id,'canceled','Annulation programmée à la fin de la période.',(select auth.uid()));
end;
$$;
revoke all on function public.trafficflow_cancel_subscription(uuid) from public,anon;
grant execute on function public.trafficflow_cancel_subscription(uuid) to authenticated;

-- Tâche périodique (service_role) : renouvellement échu => période de grâce ; grâce dépassée => expiré ; annulation => fin.
create or replace function public.trafficflow_expire_subscriptions(p_grace_days integer default 7)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer := 0; c integer;
begin
  update public.subscriptions set status='canceled', updated_at=now()
    where status='active' and cancel_at_period_end and renews_at<=now();
  get diagnostics c = row_count; n := n + c;
  update public.subscriptions set status='past_due', grace_ends_at=now()+make_interval(days=>p_grace_days), updated_at=now()
    where status='active' and not cancel_at_period_end and renews_at<=now();
  get diagnostics c = row_count; n := n + c;
  update public.subscriptions set status='expired', updated_at=now()
    where status='past_due' and grace_ends_at<=now();
  get diagnostics c = row_count; n := n + c;
  return n;
end;
$$;
revoke all on function public.trafficflow_expire_subscriptions(integer) from public,anon,authenticated;
grant execute on function public.trafficflow_expire_subscriptions(integer) to service_role;

-- Ancienne demande de changement : accepte désormais les nouveaux codes.
create or replace function public.trafficflow_request_plan_change(p_workspace_id uuid,p_plan_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_plan text; request_id uuid;
begin
  if not private.has_workspace_role(p_workspace_id,array['owner','admin']) then raise exception 'permission_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.subscription_plans where code=p_plan_code and is_public) then raise exception 'invalid_plan' using errcode='22023'; end if;
  select plan_code into current_plan from public.subscriptions where workspace_id=p_workspace_id for update;
  if current_plan is null then raise exception 'subscription_missing' using errcode='23514'; end if;
  if current_plan=p_plan_code then raise exception 'plan_already_active' using errcode='22023'; end if;
  insert into public.plan_change_requests(workspace_id,from_plan,requested_plan,requested_by)
    values(p_workspace_id,current_plan,p_plan_code,(select auth.uid()))
    on conflict(workspace_id,status) do update set from_plan=excluded.from_plan,requested_plan=excluded.requested_plan,requested_by=excluded.requested_by,created_at=now()
    returning id into request_id;
  return request_id;
end;
$$;

-- 6. Réseaux : ajouter Threads (absent de la contrainte d'origine) et laisser le trigger faire foi pour la limite.
alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
alter table public.social_accounts add constraint social_accounts_platform_check
  check (platform in ('Instagram','TikTok','X','YouTube','Facebook','LinkedIn','Messenger','Threads'));
insert into public.social_platforms (code,display_name,oauth_available,notes) values
  ('threads','Threads',false,'Connexion bientôt disponible — nécessite une application Meta approuvée.')
on conflict(code) do nothing;

create or replace function public.trafficflow_create_social_account(
  p_workspace_id uuid, p_platform text, p_handle text, p_display_name text, p_niche text default 'Créateur'
) returns integer language plpgsql security definer set search_path = '' as $$
declare new_id integer;
begin
  if not private.has_workspace_permission(p_workspace_id,'manage_social_accounts') then raise exception 'permission_denied' using errcode='42501'; end if;
  -- La limite du forfait est appliquée par le trigger social_accounts_plan_guard (forfait effectif).
  insert into public.social_accounts(workspace_id,platform,handle,display_name,niche,connection_status,created_by)
    values(p_workspace_id,p_platform,p_handle,p_display_name,p_niche,'pending',(select auth.uid())) returning id into new_id;
  insert into public.ai_assistants(workspace_id,social_account_id,updated_by) values(p_workspace_id,new_id,(select auth.uid()));
  return new_id;
end;
$$;
revoke all on function public.trafficflow_create_social_account(uuid,text,text,text,text) from public, anon;
grant execute on function public.trafficflow_create_social_account(uuid,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
