-- Intorna Pixels RC22.5 - sample catalogs shared with clients

create table if not exists public.sample_catalogs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  catalog_type text not null default 'Todos os ensaios' check (char_length(catalog_type) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1200),
  whatsapp_message text not null default 'Olá! Vi o catálogo de amostras e gostaria de saber mais sobre os ensaios.' check (char_length(whatsapp_message) <= 800),
  public_token uuid not null default gen_random_uuid() unique,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  cover_path text,
  watermark_enabled boolean not null default true,
  watermark_text text not null default 'AMOSTRA' check (char_length(watermark_text) between 1 and 80),
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, studio_id)
);

create table if not exists public.sample_catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null,
  studio_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default 'Modelo de ensaio' check (char_length(title) between 1 and 120),
  essay_type text not null default 'Outro' check (char_length(essay_type) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  image_path text not null check (char_length(image_path) between 5 and 1000),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sample_catalog_items_catalog_studio_fkey
    foreign key (catalog_id, studio_id)
    references public.sample_catalogs(id, studio_id)
    on delete cascade
);

create index if not exists sample_catalogs_studio_updated_idx
  on public.sample_catalogs(studio_id, updated_at desc);
create index if not exists sample_catalogs_created_by_idx
  on public.sample_catalogs(created_by);
create index if not exists sample_catalog_items_catalog_order_idx
  on public.sample_catalog_items(catalog_id, sort_order, created_at);
create index if not exists sample_catalog_items_catalog_studio_idx
  on public.sample_catalog_items(catalog_id, studio_id);
create index if not exists sample_catalog_items_studio_idx
  on public.sample_catalog_items(studio_id);
create index if not exists sample_catalog_items_created_by_idx
  on public.sample_catalog_items(created_by);

alter table public.sample_catalogs enable row level security;
alter table public.sample_catalog_items enable row level security;

revoke all on public.sample_catalogs from anon;
revoke all on public.sample_catalog_items from anon;
revoke all on public.sample_catalogs from authenticated;
revoke all on public.sample_catalog_items from authenticated;
grant select, insert, update, delete on public.sample_catalogs to authenticated;
grant select, insert, update, delete on public.sample_catalog_items to authenticated;

drop policy if exists sample_catalogs_select on public.sample_catalogs;
create policy sample_catalogs_select on public.sample_catalogs
  for select to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id));

drop policy if exists sample_catalogs_insert on public.sample_catalogs;
create policy sample_catalogs_insert on public.sample_catalogs
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (private.is_platform_admin() or private.is_studio_member(studio_id))
  );

drop policy if exists sample_catalogs_update on public.sample_catalogs;
create policy sample_catalogs_update on public.sample_catalogs
  for update to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id))
  with check (private.is_platform_admin() or private.is_studio_member(studio_id));

drop policy if exists sample_catalogs_delete on public.sample_catalogs;
create policy sample_catalogs_delete on public.sample_catalogs
  for delete to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id));

drop policy if exists sample_catalog_items_select on public.sample_catalog_items;
create policy sample_catalog_items_select on public.sample_catalog_items
  for select to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id));

drop policy if exists sample_catalog_items_insert on public.sample_catalog_items;
create policy sample_catalog_items_insert on public.sample_catalog_items
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (private.is_platform_admin() or private.is_studio_member(studio_id))
  );

drop policy if exists sample_catalog_items_update on public.sample_catalog_items;
create policy sample_catalog_items_update on public.sample_catalog_items
  for update to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id))
  with check (private.is_platform_admin() or private.is_studio_member(studio_id));

drop policy if exists sample_catalog_items_delete on public.sample_catalog_items;
create policy sample_catalog_items_delete on public.sample_catalog_items
  for delete to authenticated
  using (private.is_platform_admin() or private.is_studio_member(studio_id));

create or replace function public.record_sample_catalog_view(p_catalog_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sample_catalogs
  set view_count = view_count + 1,
      last_viewed_at = now()
  where id = p_catalog_id and status = 'published';
$$;

revoke all on function public.record_sample_catalog_view(uuid) from public, anon, authenticated;
grant execute on function public.record_sample_catalog_view(uuid) to service_role;

comment on table public.sample_catalogs is 'Shareable sample catalogs owned by each studio.';
comment on table public.sample_catalog_items is 'Images and essay types displayed inside sample catalogs.';
