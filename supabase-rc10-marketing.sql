-- Intorná Pixels RC10 — Marketing Performance
-- CÓPIA da migração aditiva já aplicada no projeto Supabase Intorna em 19/08/2026.
-- Não execute novamente em produção sem necessidade; o arquivo fica no pacote para versionamento.
create table if not exists public.marketing_connections (
  id uuid primary key default gen_random_uuid(), studio_id uuid not null references public.studios(id) on delete cascade,
  provider text not null check (provider in ('meta','google','tiktok')), account_external_id text, account_label text,
  status text not null default 'disconnected' check (status in ('disconnected','ready','syncing','error')),
  last_sync_at timestamptz, last_error text, settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(studio_id,provider)
);
create table if not exists public.marketing_snapshots (
  id uuid primary key default gen_random_uuid(), studio_id uuid not null references public.studios(id) on delete cascade,
  provider text not null check (provider in ('meta','google','tiktok','manual')), snapshot_date date not null default current_date,
  spend numeric(12,2) not null default 0 check(spend>=0), impressions bigint not null default 0 check(impressions>=0),
  clicks bigint not null default 0 check(clicks>=0), leads integer not null default 0 check(leads>=0), conversions integer not null default 0 check(conversions>=0),
  attributed_revenue numeric(12,2) not null default 0 check(attributed_revenue>=0), currency text not null default 'BRL',
  raw jsonb not null default '{}'::jsonb, synced_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(studio_id,provider,snapshot_date)
);
create table if not exists public.marketing_goals (
  studio_id uuid primary key references public.studios(id) on delete cascade, monthly_revenue_goal numeric(12,2) not null default 3000 check(monthly_revenue_goal>=0),
  max_cpl numeric(12,2), max_cpa numeric(12,2), min_roas numeric(8,2), updated_at timestamptz not null default now()
);
