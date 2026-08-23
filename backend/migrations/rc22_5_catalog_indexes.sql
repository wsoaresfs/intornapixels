-- Indexes added after the RC22.5 database advisor review.

create index if not exists sample_catalogs_created_by_idx
  on public.sample_catalogs(created_by);

create index if not exists sample_catalog_items_catalog_studio_idx
  on public.sample_catalog_items(catalog_id, studio_id);

create index if not exists sample_catalog_items_created_by_idx
  on public.sample_catalog_items(created_by);
