-- Permissões explícitas para instalações novas do Supabase Data API.
-- RLS continua sendo a camada que isola cada estúdio.
grant usage on schema public to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','platform_admins','plans','studios','studio_members','subscriptions','payments',
    'clients','orders','extra_sales','checklists','coupons','coupon_redemptions','announcements',
    'support_tickets','usage_monthly','audit_logs','platform_settings','portal_links',
    'client_references','gallery_items','gallery_selections','client_payments','cost_entries',
    'shoot_templates','template_favorites','referral_codes','referrals','ai_generation_jobs',
    'ai_usage_monthly','whatsapp_connections','whatsapp_contacts','whatsapp_conversations',
    'whatsapp_messages','whatsapp_quick_replies'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
      execute format('grant all on table public.%I to service_role',t);
    end if;
  end loop;
end $$;

grant usage,select on all sequences in schema public to authenticated, service_role;
