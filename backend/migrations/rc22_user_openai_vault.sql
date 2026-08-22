-- RC22.1: credencial OpenAI individual por usuário, criptografada no Supabase Vault.
create schema if not exists private;

create table if not exists private.user_ai_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai')),
  secret_id uuid not null,
  last_four text not null check (char_length(last_four) = 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

revoke all on table private.user_ai_credentials from public, anon, authenticated;
grant all on table private.user_ai_credentials to service_role;

create or replace function public.set_user_ai_secret(
  p_user_id uuid,
  p_provider text,
  p_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_value text := trim(coalesce(p_value, ''));
  v_existing uuid;
  v_secret uuid;
begin
  if p_user_id is null then raise exception 'Usuário obrigatório'; end if;
  if v_provider <> 'openai' then raise exception 'Provedor inválido'; end if;
  if char_length(v_value) < 20 or v_value not like 'sk-%' then
    raise exception 'Chave OpenAI inválida';
  end if;

  select secret_id into v_existing
  from private.user_ai_credentials
  where user_id = p_user_id and provider = v_provider
  for update;

  if v_existing is null then
    select vault.create_secret(
      v_value,
      'intorna_user_' || p_user_id::text || '_' || v_provider,
      'Intorná Pixels: credencial individual ' || v_provider
    ) into v_secret;
  else
    perform vault.update_secret(
      v_existing,
      v_value,
      'intorna_user_' || p_user_id::text || '_' || v_provider,
      'Intorná Pixels: credencial individual ' || v_provider
    );
    v_secret := v_existing;
  end if;

  insert into private.user_ai_credentials(user_id, provider, secret_id, last_four)
  values (p_user_id, v_provider, v_secret, right(v_value, 4))
  on conflict (user_id, provider) do update
  set secret_id = excluded.secret_id,
      last_four = excluded.last_four,
      updated_at = now();

  return jsonb_build_object('configured', true, 'provider', v_provider, 'lastFour', right(v_value, 4));
end
$$;

create or replace function public.get_user_ai_secret(
  p_user_id uuid,
  p_provider text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from private.user_ai_credentials c
  join vault.decrypted_secrets ds on ds.id = c.secret_id
  where c.user_id = p_user_id
    and c.provider = lower(trim(coalesce(p_provider, '')))
  limit 1
$$;

create or replace function public.get_user_ai_secret_status(
  p_user_id uuid,
  p_provider text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'configured', true,
        'provider', c.provider,
        'lastFour', c.last_four,
        'updatedAt', c.updated_at
      )
      from private.user_ai_credentials c
      where c.user_id = p_user_id
        and c.provider = lower(trim(coalesce(p_provider, '')))
    ),
    jsonb_build_object('configured', false, 'provider', lower(trim(coalesce(p_provider, ''))))
  )
$$;

create or replace function public.delete_user_ai_secret(
  p_user_id uuid,
  p_provider text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  delete from private.user_ai_credentials
  where user_id = p_user_id
    and provider = lower(trim(coalesce(p_provider, '')))
  returning secret_id into v_secret;

  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
    return true;
  end if;
  return false;
end
$$;

revoke all on function public.set_user_ai_secret(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_user_ai_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.get_user_ai_secret_status(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_user_ai_secret(uuid, text) from public, anon, authenticated;

grant execute on function public.set_user_ai_secret(uuid, text, text) to service_role;
grant execute on function public.get_user_ai_secret(uuid, text) to service_role;
grant execute on function public.get_user_ai_secret_status(uuid, text) to service_role;
grant execute on function public.delete_user_ai_secret(uuid, text) to service_role;
