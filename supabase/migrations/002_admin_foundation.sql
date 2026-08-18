-- Intorná Pixels — base administrativa, helpers privados e compatibilidade do workspace
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter table public.profiles add column if not exists email text;
alter table public.support_tickets add column if not exists priority text not null default 'medium'
  check (priority in ('low','medium','high'));
alter table public.orders add column if not exists package_id text;
alter table public.orders add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists extra_strategy text not null default 'avulsa';

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.platform_admins where user_id=(select auth.uid()));
$$;
create or replace function private.is_studio_member(sid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.studio_members where studio_id=sid and user_id=(select auth.uid()) and active);
$$;
create or replace function private.can_manage_studio(sid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_platform_admin() or exists(
    select 1 from public.studio_members
    where studio_id=sid and user_id=(select auth.uid()) and active and role in ('owner','admin')
  );
$$;
revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.is_studio_member(uuid) from public, anon;
revoke all on function private.can_manage_studio(uuid) from public, anon;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.is_studio_member(uuid) to authenticated, service_role;
grant execute on function private.can_manage_studio(uuid) to authenticated, service_role;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$ select private.is_platform_admin(); $$;
create or replace function public.is_studio_member(sid uuid)
returns boolean language sql stable security definer set search_path='' as $$ select private.is_studio_member(sid); $$;
create or replace function public.can_manage_studio(sid uuid)
returns boolean language sql stable security definer set search_path='' as $$ select private.can_manage_studio(sid); $$;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_studio_member(uuid) from public, anon;
revoke all on function public.can_manage_studio(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_studio_member(uuid) to authenticated, service_role;
grant execute on function public.can_manage_studio(uuid) to authenticated, service_role;

create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id=1),
  brand text not null default 'Intorná Pixels',
  support_email text,
  support_whatsapp text,
  pix text,
  trial_days integer not null default 7 check (trial_days between 0 and 365),
  maintenance boolean not null default false,
  maintenance_message text not null default 'Estamos realizando uma manutenção rápida. Tente novamente em alguns minutos.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(id) values(1) on conflict(id) do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_admin on public.platform_settings;
create policy platform_settings_admin on public.platform_settings for all to authenticated
using(private.is_platform_admin()) with check(private.is_platform_admin());
drop trigger if exists platform_settings_touch on public.platform_settings;
create trigger platform_settings_touch before update on public.platform_settings
for each row execute function public.touch_updated_at();

grant select,update on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
