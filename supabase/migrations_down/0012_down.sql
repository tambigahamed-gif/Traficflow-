-- Retour arrière prudent de 0012. À exécuter seulement si aucun abonnement n'utilise free/standard.
-- Vérifier d'abord : select plan_code, count(*) from public.subscriptions group by 1;
begin;
drop trigger if exists link_pages_plan_guard on public.link_pages;
drop trigger if exists posts_plan_guard on public.posts;
drop function if exists private.enforce_link_page_limit();
drop function if exists private.enforce_scheduled_post_limit();
drop function if exists public.trafficflow_get_usage_v3(uuid);
drop function if exists public.trafficflow_create_payment(uuid,text,text);
drop function if exists public.trafficflow_apply_payment_result(text,text,text,text,numeric,boolean,text);
drop function if exists public.trafficflow_cancel_subscription(uuid);
drop function if exists public.trafficflow_expire_subscriptions(integer);
-- Les tables de paiement contiennent un historique : on les conserve (renommer plutôt que supprimer si besoin).
-- Restaurer ensuite les corps d'origine de private.handle_new_user (0001), private.enforce_social_account_limit (0009),
-- public.trafficflow_consume_ai_message / trafficflow_create_invitation (0001) et trafficflow_request_plan_change (0006)
-- en ré-exécutant leurs blocs "create or replace function".
drop function if exists private.effective_plan(uuid);
commit;
