-- Intorna Pixels RC22.4 - controlled external beta
-- Capacity, invite secret, legal consent trail and participant access.

alter table public.platform_integrations
  add column if not exists beta_invite_secret_id uuid;

alter table public.platform_settings
  add column if not exists beta_enabled boolean not null default true,
  add column if not exists beta_capacity integer not null default 3,
  add column if not exists terms_version text not null default '2026-08-23',
  add column if not exists privacy_version text not null default '2026-08-23';

alter table public.platform_settings
  drop constraint if exists platform_settings_beta_capacity_check;
alter table public.platform_settings
  add constraint platform_settings_beta_capacity_check
  check (beta_capacity between 0 and 1000);

insert into public.platform_settings (id, beta_enabled, beta_capacity, terms_version, privacy_version)
values (1, true, 3, '2026-08-23', '2026-08-23')
on conflict (id) do update set
  beta_enabled = excluded.beta_enabled,
  beta_capacity = excluded.beta_capacity,
  terms_version = excluded.terms_version,
  privacy_version = excluded.privacy_version,
  updated_at = now();

create table if not exists public.beta_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  studio_id uuid unique references public.studios(id) on delete cascade,
  email text not null,
  full_name text not null,
  studio_name text not null,
  status text not null default 'registered'
    check (status in ('registered','active','completed','removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists beta_participants_email_lower_key
  on public.beta_participants (lower(email));

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms','privacy')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'beta_registration',
  unique (user_id, document_type, document_version)
);

alter table public.beta_participants enable row level security;
alter table public.legal_consents enable row level security;

revoke all on public.beta_participants from anon;
revoke all on public.legal_consents from anon;
revoke all on public.beta_participants from authenticated;
revoke all on public.legal_consents from authenticated;
grant select on public.beta_participants to authenticated;
grant select on public.legal_consents to authenticated;

drop policy if exists beta_participants_select on public.beta_participants;
create policy beta_participants_select on public.beta_participants
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists legal_consents_select on public.legal_consents;
create policy legal_consents_select on public.legal_consents
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

create or replace function private.capture_beta_legal_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), '');
  v_privacy text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'privacy_version', '')), '');
  v_source text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'registration_source'), ''), 'beta_registration'), 80);
  v_accepted_at timestamptz;
begin
  if lower(coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false')) = 'true'
     and lower(coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false')) = 'true'
     and v_terms is not null and v_privacy is not null then
    begin
      v_accepted_at := coalesce((new.raw_user_meta_data ->> 'legal_accepted_at')::timestamptz, now());
    exception when others then
      v_accepted_at := now();
    end;
    insert into public.legal_consents(user_id, document_type, document_version, accepted_at, source)
    values
      (new.id, 'terms', v_terms, v_accepted_at, v_source),
      (new.id, 'privacy', v_privacy, v_accepted_at, v_source)
    on conflict (user_id, document_type, document_version) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.capture_beta_legal_consents() from public, anon, authenticated;

drop trigger if exists on_auth_user_capture_beta_legal_consents on auth.users;
create trigger on_auth_user_capture_beta_legal_consents
after insert on auth.users
for each row execute function private.capture_beta_legal_consents();

create or replace function public.get_platform_integration_secret(p_provider text)
returns text
language sql
stable
security definer
set search_path = 'public', 'vault'
as $$
  select ds.decrypted_secret
  from public.platform_integrations pi
  left join vault.decrypted_secrets ds on ds.id = case lower(trim(coalesce(p_provider,'')))
    when 'openai' then pi.openai_secret_id
    when 'google' then pi.google_secret_id
    when 'asaas' then pi.asaas_secret_id
    when 'asaas_webhook' then pi.asaas_webhook_secret_id
    when 'waha' then pi.waha_secret_id
    when 'beta_invite' then pi.beta_invite_secret_id
    else null end
  where pi.id = 1
$$;

create or replace function public.set_platform_integration_secret(p_provider text, p_value text)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'vault'
as $$
declare
  v_provider text := lower(trim(coalesce(p_provider,'')));
  v_value text := trim(coalesce(p_value,''));
  v_existing uuid;
  v_secret uuid;
begin
  if v_provider not in ('openai','google','asaas','asaas_webhook','waha','beta_invite') then
    raise exception 'Provedor de integração inválido';
  end if;
  if v_value = '' then raise exception 'Segredo vazio não é permitido'; end if;

  select case v_provider
    when 'openai' then openai_secret_id
    when 'google' then google_secret_id
    when 'asaas' then asaas_secret_id
    when 'asaas_webhook' then asaas_webhook_secret_id
    when 'waha' then waha_secret_id
    when 'beta_invite' then beta_invite_secret_id end
  into v_existing
  from public.platform_integrations where id = 1 for update;

  if v_existing is null then
    select vault.create_secret(v_value, 'intorna_' || v_provider,
      'Intorna Pixels platform integration secret: ' || v_provider) into v_secret;
  else
    perform vault.update_secret(v_existing, v_value, 'intorna_' || v_provider,
      'Intorna Pixels platform integration secret: ' || v_provider);
    v_secret := v_existing;
  end if;

  update public.platform_integrations set
    openai_secret_id = case when v_provider='openai' then v_secret else openai_secret_id end,
    google_secret_id = case when v_provider='google' then v_secret else google_secret_id end,
    asaas_secret_id = case when v_provider='asaas' then v_secret else asaas_secret_id end,
    asaas_webhook_secret_id = case when v_provider='asaas_webhook' then v_secret else asaas_webhook_secret_id end,
    waha_secret_id = case when v_provider='waha' then v_secret else waha_secret_id end,
    beta_invite_secret_id = case when v_provider='beta_invite' then v_secret else beta_invite_secret_id end,
    updated_at = now()
  where id = 1;
  return v_secret;
end
$$;

revoke all on function public.get_platform_integration_secret(text) from public, anon, authenticated;
revoke all on function public.set_platform_integration_secret(text,text) from public, anon, authenticated;
grant execute on function public.get_platform_integration_secret(text) to service_role;
grant execute on function public.set_platform_integration_secret(text,text) to service_role;

comment on table public.beta_participants is 'Controlled external beta access and activation status.';
comment on table public.legal_consents is 'Versioned Terms and Privacy acceptance audit trail.';
