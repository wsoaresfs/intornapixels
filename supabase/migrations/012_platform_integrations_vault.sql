create extension if not exists supabase_vault with schema vault;

create table if not exists public.platform_integrations (
  id smallint primary key default 1 check (id = 1),
  openai_secret_id uuid,
  google_secret_id uuid,
  asaas_secret_id uuid,
  asaas_webhook_secret_id uuid,
  waha_secret_id uuid,
  image_provider_default text not null default 'auto' check (image_provider_default in ('auto','openai','google','google_pro')),
  openai_model text not null default 'gpt-image-1',
  google_model text not null default 'gemini-3.1-flash-image',
  google_pro_model text not null default 'gemini-3-pro-image',
  asaas_environment text not null default 'sandbox' check (asaas_environment in ('sandbox','production')),
  waha_base_url text,
  waha_session text not null default 'default',
  updated_at timestamptz not null default now()
);

insert into public.platform_integrations(id) values (1) on conflict(id) do nothing;
alter table public.platform_integrations enable row level security;
revoke all on public.platform_integrations from anon, authenticated;
grant select, insert, update on public.platform_integrations to service_role;

create or replace function public.set_platform_integration_secret(p_provider text, p_value text)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare
  v_provider text := lower(trim(coalesce(p_provider,'')));
  v_value text := trim(coalesce(p_value,''));
  v_existing uuid;
  v_secret uuid;
begin
  if v_provider not in ('openai','google','asaas','asaas_webhook','waha') then raise exception 'Provedor de integração inválido'; end if;
  if v_value = '' then raise exception 'Segredo vazio não é permitido'; end if;
  select case v_provider
    when 'openai' then openai_secret_id
    when 'google' then google_secret_id
    when 'asaas' then asaas_secret_id
    when 'asaas_webhook' then asaas_webhook_secret_id
    when 'waha' then waha_secret_id
  end into v_existing
  from public.platform_integrations where id = 1 for update;

  if v_existing is null then
    select vault.create_secret(v_value,'intorna_' || v_provider,'Intorna Pixels platform integration secret: ' || v_provider) into v_secret;
  else
    perform vault.update_secret(v_existing,v_value,'intorna_' || v_provider,'Intorna Pixels platform integration secret: ' || v_provider);
    v_secret := v_existing;
  end if;

  update public.platform_integrations set
    openai_secret_id = case when v_provider='openai' then v_secret else openai_secret_id end,
    google_secret_id = case when v_provider='google' then v_secret else google_secret_id end,
    asaas_secret_id = case when v_provider='asaas' then v_secret else asaas_secret_id end,
    asaas_webhook_secret_id = case when v_provider='asaas_webhook' then v_secret else asaas_webhook_secret_id end,
    waha_secret_id = case when v_provider='waha' then v_secret else waha_secret_id end,
    updated_at = now()
  where id = 1;
  return v_secret;
end $$;

create or replace function public.get_platform_integration_secret(p_provider text)
returns text language sql stable security definer set search_path = public, vault as $$
  select ds.decrypted_secret
  from public.platform_integrations pi
  left join vault.decrypted_secrets ds on ds.id = case lower(trim(coalesce(p_provider,'')))
    when 'openai' then pi.openai_secret_id
    when 'google' then pi.google_secret_id
    when 'asaas' then pi.asaas_secret_id
    when 'asaas_webhook' then pi.asaas_webhook_secret_id
    when 'waha' then pi.waha_secret_id
    else null
  end
  where pi.id = 1
$$;

revoke all on function public.set_platform_integration_secret(text,text) from public, anon, authenticated;
revoke all on function public.get_platform_integration_secret(text) from public, anon, authenticated;
grant execute on function public.set_platform_integration_secret(text,text) to service_role;
grant execute on function public.get_platform_integration_secret(text) to service_role;
revoke all on vault.decrypted_secrets from anon, authenticated;
