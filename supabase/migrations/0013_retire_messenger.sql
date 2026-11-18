begin;

-- Retire Messenger du catalogue actif sans casser les références historiques
-- (social_accounts et social_connections peuvent encore pointer vers ce code).
update public.social_platforms
set oauth_available = false,
    notes = 'Plateforme retirée de TrafficFlow le 2026-11-01. Les fiches et publications historiques sont conservées; aucune nouvelle connexion n’est acceptée.'
where code = 'messenger';

-- Refuse uniquement les INSERT Messenger et les changements vers Messenger.
-- Les lignes historiques Messenger restent lisibles, modifiables sur leurs
-- autres champs, et supprimables selon les droits existants.
create or replace function private.trafficflow_block_retired_messenger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_TABLE_NAME = 'social_accounts' then
    if TG_OP = 'INSERT' then
      if NEW.platform = 'Messenger' then
        raise exception 'platform_retired:Messenger' using errcode = '22023';
      end if;
    elsif TG_OP = 'UPDATE' then
      if NEW.platform = 'Messenger' and OLD.platform is distinct from NEW.platform then
        raise exception 'platform_retired:Messenger' using errcode = '22023';
      end if;
    end if;
  elsif TG_TABLE_NAME in ('posts', 'tasks', 'account_assignments', 'ai_assistants', 'media_account_links')
        and NEW.social_account_id is not null then
    if exists (
      select 1
      from public.social_accounts sa
      where sa.id = NEW.social_account_id
        and sa.workspace_id = NEW.workspace_id
        and sa.platform = 'Messenger'
    ) then
      raise exception 'platform_retired:Messenger' using errcode = '22023';
    end if;
  elsif TG_TABLE_NAME = 'social_connections' and NEW.provider_code = 'messenger' then
    raise exception 'platform_retired:Messenger' using errcode = '22023';
  end if;
  return NEW;
end;
$$;

revoke all on function private.trafficflow_block_retired_messenger() from public, anon;
grant execute on function private.trafficflow_block_retired_messenger() to authenticated;

drop trigger if exists social_accounts_reject_retired_messenger on public.social_accounts;
create trigger social_accounts_reject_retired_messenger
before insert or update of platform on public.social_accounts
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists posts_reject_retired_messenger on public.posts;
create trigger posts_reject_retired_messenger
before insert or update of social_account_id on public.posts
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists tasks_reject_retired_messenger on public.tasks;
create trigger tasks_reject_retired_messenger
before insert or update of social_account_id on public.tasks
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists account_assignments_reject_retired_messenger on public.account_assignments;
create trigger account_assignments_reject_retired_messenger
before insert or update of social_account_id on public.account_assignments
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists ai_assistants_reject_retired_messenger on public.ai_assistants;
create trigger ai_assistants_reject_retired_messenger
before insert or update of social_account_id on public.ai_assistants
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists media_account_links_reject_retired_messenger on public.media_account_links;
create trigger media_account_links_reject_retired_messenger
before insert or update of social_account_id on public.media_account_links
for each row execute function private.trafficflow_block_retired_messenger();

drop trigger if exists social_connections_reject_retired_messenger on public.social_connections;
create trigger social_connections_reject_retired_messenger
before insert or update of provider_code on public.social_connections
for each row execute function private.trafficflow_block_retired_messenger();

notify pgrst, 'reload schema';
commit;
