-- v7: App ID / App Secret da Meta e versão Graph API
alter table public.whatsapp_platform_config add column if not exists meta_app_id text;
alter table public.whatsapp_platform_config add column if not exists meta_app_secret_id uuid;
alter table public.whatsapp_platform_config add column if not exists graph_version text not null default 'v23.0';
create or replace function public.set_whatsapp_meta_platform(p_app_id text,p_app_secret text,p_graph_version text default 'v23.0')
returns void language plpgsql security definer set search_path=public,vault as $$
declare v_id uuid; v_existing uuid;
begin
 select meta_app_secret_id into v_existing from public.whatsapp_platform_config where id=1;
 if coalesce(p_app_secret,'')<>'' then
   if v_existing is null then
     select vault.create_secret(p_app_secret,'whatsapp_meta_app_secret','Meta App Secret for WhatsApp webhook signature validation') into v_id;
   else
     perform vault.update_secret(v_existing,p_app_secret,'whatsapp_meta_app_secret','Meta App Secret for WhatsApp webhook signature validation'); v_id:=v_existing;
   end if;
 else v_id:=v_existing; end if;
 update public.whatsapp_platform_config set meta_app_id=nullif(p_app_id,''),meta_app_secret_id=v_id,graph_version=coalesce(nullif(p_graph_version,''),'v23.0'),updated_at=now() where id=1;
end $$;
create or replace function public.get_whatsapp_meta_app_secret()
returns text language sql stable security definer set search_path=public,vault as $$
 select ds.decrypted_secret from public.whatsapp_platform_config pc left join vault.decrypted_secrets ds on ds.id=pc.meta_app_secret_id where pc.id=1
$$;
create or replace function public.get_whatsapp_graph_version()
returns text language sql stable security definer set search_path=public as $$ select coalesce(graph_version,'v23.0') from public.whatsapp_platform_config where id=1 $$;
revoke all on function public.set_whatsapp_meta_platform(text,text,text),public.get_whatsapp_meta_app_secret(),public.get_whatsapp_graph_version() from public,anon,authenticated;
grant execute on function public.set_whatsapp_meta_platform(text,text,text),public.get_whatsapp_meta_app_secret(),public.get_whatsapp_graph_version() to service_role;
