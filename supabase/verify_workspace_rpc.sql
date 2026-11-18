-- Run in the Supabase SQL Editor after migrations 0001–0011.
-- Read-only checks; these statements do not change project data or schema.
select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'trafficflow_get_my_workspaces'
limit 5;

select
  t.tgname as trigger_name,
  t.tgenabled as trigger_enabled,
  p.oid::regprocedure as trigger_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'on_auth_user_created_trafficflow'
  and not t.tgisinternal
limit 5;
