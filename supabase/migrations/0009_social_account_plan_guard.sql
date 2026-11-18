begin;

create or replace function private.enforce_social_account_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cap integer; current_count integer;
begin
  perform 1 from public.subscriptions s where s.workspace_id=new.workspace_id for update;
  select sp.social_account_limit into cap
    from public.subscriptions s join public.subscription_plans sp on sp.code=s.plan_code
    where s.workspace_id=new.workspace_id;
  if cap is null then raise exception 'subscription_missing' using errcode='23514'; end if;
  select count(*)::integer into current_count from public.social_accounts sa
    where sa.workspace_id=new.workspace_id and (tg_op='INSERT' or sa.id<>new.id);
  if current_count>=cap then raise exception 'plan_limit:social_accounts' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_social_account_limit() from public,anon,authenticated;
drop trigger if exists social_accounts_plan_guard on public.social_accounts;
create trigger social_accounts_plan_guard before insert on public.social_accounts
for each row execute function private.enforce_social_account_limit();

commit;
