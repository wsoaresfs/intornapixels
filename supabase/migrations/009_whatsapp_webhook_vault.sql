-- v7: token global de verificação do webhook protegido no Supabase Vault
create table if not exists public.whatsapp_platform_config (
 id smallint primary key default 1 check(id=1),
 verify_token_secret_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.whatsapp_platform_config enable row level security;
revoke all on public.whatsapp_platform_config from anon,authenticated;
grant select,insert,update on public.whatsapp_platform_config to service_role;
do $$ declare sid uuid; begin
 if not exists(select 1 from public.whatsapp_platform_config where id=1) then
   select vault.create_secret(encode(gen_random_bytes(24),'hex'),'whatsapp_webhook_verify_token','Meta WhatsApp webhook verification token') into sid;
   insert into public.whatsapp_platform_config(id,verify_token_secret_id) values(1,sid);
 end if;
end $$;
create or replace function public.get_whatsapp_webhook_verify_token()
returns text language sql stable security definer set search_path=public,vault as $$
 select ds.decrypted_secret from public.whatsapp_platform_config pc join vault.decrypted_secrets ds on ds.id=pc.verify_token_secret_id where pc.id=1
$$;
revoke all on function public.get_whatsapp_webhook_verify_token() from public,anon,authenticated;
grant execute on function public.get_whatsapp_webhook_verify_token() to service_role;
