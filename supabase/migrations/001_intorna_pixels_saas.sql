-- Intorná Pixels SaaS v4 — Supabase/Postgres schema
-- Execute no SQL Editor de um projeto Supabase novo.
create extension if not exists pgcrypto;

create type public.studio_status as enum ('trial','active','blocked','cancelled');
create type public.billing_status as enum ('free','pending','paid','overdue','cancelled');
create type public.member_role as enum ('owner','admin','operator');
create type public.order_status as enum ('aguardando_fotos','pagamento_pendente','em_producao','em_revisao','pronto','entregue','cancelado');
create type public.payment_status as enum ('pending','confirmed','received','overdue','refunded','cancelled','failed');
create type public.ticket_status as enum ('open','in_progress','closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.plans (
  id text primary key,
  name text not null,
  price numeric(10,2) not null default 0,
  order_limit integer not null,
  client_limit integer not null,
  user_limit integer not null default 1,
  active boolean not null default true,
  features jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid not null references auth.users(id),
  whatsapp text,
  city text,
  plan_id text not null references public.plans(id) default 'free',
  status public.studio_status not null default 'trial',
  billing_status public.billing_status not null default 'free',
  trial_ends_at timestamptz,
  next_billing_at timestamptz,
  asaas_customer_id text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_members (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (studio_id,user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  plan_id text not null references public.plans(id),
  provider text not null default 'asaas',
  provider_subscription_id text unique,
  billing_type text,
  amount numeric(10,2) not null,
  cycle text not null default 'MONTHLY',
  status text not null default 'pending',
  next_due_date date,
  started_at timestamptz not null default now(),
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'asaas',
  provider_payment_id text unique,
  amount numeric(10,2) not null,
  status public.payment_status not null default 'pending',
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  pix_qr_code text,
  pix_payload text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  whatsapp text,
  city text,
  important_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_name text not null,
  included_photos integer not null,
  order_value numeric(10,2) not null default 0,
  essay_type text,
  format text default '4:5',
  status public.order_status not null default 'aguardando_fotos',
  payment_status public.payment_status not null default 'pending',
  payment_method text,
  deadline_at timestamptz,
  extra_offer_qty integer not null default 0,
  watermark_extras boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.extra_sales (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  quantity integer not null,
  amount numeric(10,2) not null,
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  items jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  value numeric(10,2) not null,
  max_redemptions integer,
  redemptions integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(coupon_id,studio_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  opened_by uuid not null references auth.users(id),
  subject text not null,
  message text not null,
  status public.ticket_status not null default 'open',
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_monthly (
  studio_id uuid not null references public.studios(id) on delete cascade,
  month date not null,
  orders_count integer not null default 0,
  clients_count integer not null default 0,
  storage_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (studio_id,month)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  studio_id uuid references public.studios(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  provider text not null,
  event_key text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  primary key(provider,event_key)
);

insert into public.plans(id,name,price,order_limit,client_limit,user_limit,features,sort_order) values
('free','Gratuito',0,10,5,1,'["CRM básico","Gerador básico","Até 10 ensaios/mês"]',0),
('start','Start',19.90,30,999999,1,'["AI Director","Financeiro básico","Marca-d’água em lote","Até 30 ensaios/mês"]',1),
('pro','Pro',39.90,150,999999,2,'["Biblioteca completa","Dashboard financeiro","Upsell","Até 150 ensaios/mês"]',2),
('studio','Studio',69.90,999999,999999,5,'["Até 5 usuários","Marca personalizada","Relatórios","Suporte prioritário"]',3)
on conflict(id) do update set name=excluded.name,price=excluded.price,order_limit=excluded.order_limit,client_limit=excluded.client_limit,user_limit=excluded.user_limit,features=excluded.features,sort_order=excluded.sort_order;

-- Atualiza updated_at automaticamente
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','plans','studios','subscriptions','payments','clients','orders','support_tickets'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',t,t);
  end loop;
end $$;

-- Cria perfil ao cadastrar usuário no Supabase Auth.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'phone') on conflict(id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Funções auxiliares de autorização.
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid());
$$;
create or replace function public.is_studio_member(sid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.studio_members sm where sm.studio_id=sid and sm.user_id=auth.uid() and sm.active);
$$;
create or replace function public.can_manage_studio(sid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(select 1 from public.studio_members sm where sm.studio_id=sid and sm.user_id=auth.uid() and sm.active and sm.role in ('owner','admin'));
$$;

-- Índices principais
create index if not exists clients_studio_idx on public.clients(studio_id);
create index if not exists orders_studio_created_idx on public.orders(studio_id,created_at desc);
create index if not exists orders_client_idx on public.orders(client_id);
create index if not exists payments_studio_created_idx on public.payments(studio_id,created_at desc);
create index if not exists subscriptions_studio_idx on public.subscriptions(studio_id);
create index if not exists tickets_studio_idx on public.support_tickets(studio_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.plans enable row level security;
alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.extra_sales enable row level security;
alter table public.checklists enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.announcements enable row level security;
alter table public.support_tickets enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_platform_admin());
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid() or public.is_platform_admin()) with check(id=auth.uid() or public.is_platform_admin());
create policy admin_self_read on public.platform_admins for select to authenticated using(user_id=auth.uid() or public.is_platform_admin());
create policy plans_read on public.plans for select to authenticated using(active or public.is_platform_admin());
create policy plans_admin_all on public.plans for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy studios_read on public.studios for select to authenticated using(public.is_platform_admin() or public.is_studio_member(id));
create policy studios_manage on public.studios for update to authenticated using(public.can_manage_studio(id)) with check(public.can_manage_studio(id));
create policy members_read on public.studio_members for select to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy members_manage on public.studio_members for all to authenticated using(public.can_manage_studio(studio_id)) with check(public.can_manage_studio(studio_id));

-- Tabelas tenant-scoped: membro vê/grava apenas o próprio estúdio; admin da plataforma vê tudo.
create policy subscriptions_read on public.subscriptions for select to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy payments_read on public.payments for select to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy clients_all on public.clients for all to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id)) with check(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy orders_all on public.orders for all to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id)) with check(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy extras_all on public.extra_sales for all to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id)) with check(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy checklists_all on public.checklists for all to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id)) with check(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy redemptions_read on public.coupon_redemptions for select to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy announcements_read on public.announcements for select to authenticated using(active or public.is_platform_admin());
create policy announcements_admin on public.announcements for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy tickets_all on public.support_tickets for all to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id)) with check(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy usage_read on public.usage_monthly for select to authenticated using(public.is_platform_admin() or public.is_studio_member(studio_id));
create policy audit_read on public.audit_logs for select to authenticated using(public.is_platform_admin() or (studio_id is not null and public.is_studio_member(studio_id)));
create policy coupons_admin on public.coupons for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

-- Admin pode criar estúdios/assinaturas; operações sensíveis de cobrança devem passar por Edge Functions/service role.
create policy studios_admin_insert on public.studios for insert to authenticated with check(public.is_platform_admin());
create policy subscriptions_admin_write on public.subscriptions for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy payments_admin_write on public.payments for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

-- Função para contabilizar uso mensal ao criar pedido.
create or replace function public.increment_monthly_usage() returns trigger language plpgsql security definer set search_path=public as $$
declare m date := date_trunc('month',new.created_at)::date;
begin
  insert into public.usage_monthly(studio_id,month,orders_count) values(new.studio_id,m,1)
  on conflict(studio_id,month) do update set orders_count=public.usage_monthly.orders_count+1,updated_at=now();
  return new;
end $$;
create trigger orders_usage_after_insert after insert on public.orders for each row execute function public.increment_monthly_usage();

-- IMPORTANTE: depois de criar seu usuário administrador no Auth, execute:
-- insert into public.platform_admins(user_id) values ('UUID-DO-SEU-USUARIO');
