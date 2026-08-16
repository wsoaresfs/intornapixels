-- Intorná Pixels v6 - suporte ao checkout do cliente
alter table public.clients add column if not exists asaas_customer_id text;
alter table public.gallery_items add column if not exists sold_at timestamptz;
create index if not exists clients_asaas_customer_idx on public.clients(asaas_customer_id) where asaas_customer_id is not null;
