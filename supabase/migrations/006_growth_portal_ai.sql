-- Intorná Pixels v6 — growth, client portal, gallery, marketplace, profitability and AI generation

alter table public.clients add column if not exists email text;
alter table public.plans add column if not exists ai_image_limit integer not null default 0;
alter table public.plans add column if not exists client_portal boolean not null default true;
alter table public.plans add column if not exists marketplace_access boolean not null default false;
alter table public.plans add column if not exists white_label boolean not null default false;

update public.plans set ai_image_limit=0, client_portal=true, marketplace_access=false, white_label=false where id='free';
update public.plans set ai_image_limit=5, client_portal=true, marketplace_access=true, white_label=false where id='start';
update public.plans set ai_image_limit=30, client_portal=true, marketplace_access=true, white_label=false where id='pro';
update public.plans set ai_image_limit=100, client_portal=true, marketplace_access=true, white_label=true where id='studio';

create table if not exists public.portal_links (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  enabled boolean not null default true,
  expires_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id)
);

create table if not exists public.client_references (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  file_path text not null,
  original_name text,
  mime_type text,
  note text,
  source text not null default 'client' check (source in ('client','studio')),
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  label text,
  source text not null default 'uploaded' check (source in ('uploaded','generated')),
  kind text not null default 'contracted' check (kind in ('contracted','extra')),
  preview_path text,
  final_path text,
  mime_type text default 'image/png',
  price numeric(10,2) not null default 0 check (price >= 0),
  status text not null default 'draft' check (status in ('draft','preview','sold','released','hidden')),
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_selections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  gallery_item_id uuid not null references public.gallery_items(id) on delete cascade,
  selected boolean not null default true,
  client_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gallery_item_id)
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'asaas',
  provider_payment_id text unique,
  purchase_type text not null default 'extras' check (purchase_type in ('extras','upgrade')),
  amount numeric(10,2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  pix_qr_code text,
  pix_payload text,
  items jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  category text not null check (category in ('ai','ads','tools','commission','labor','other')),
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.shoot_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  description text,
  cover_url text,
  premium boolean not null default false,
  active boolean not null default true,
  blueprint jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_favorites (
  studio_id uuid not null references public.studios(id) on delete cascade,
  template_id uuid not null references public.shoot_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(studio_id,template_id)
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null unique references public.studios(id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  reward_value numeric(10,2) not null default 19.90,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_studio_id uuid not null references public.studios(id) on delete cascade,
  referred_studio_id uuid not null unique references public.studios(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','cancelled')),
  reward_value numeric(10,2) not null default 0,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  model text not null default 'gpt-image-2',
  prompt text not null,
  size text not null default '1024x1536',
  quality text not null default 'medium',
  quantity integer not null default 1 check (quantity between 1 and 4),
  reference_paths jsonb not null default '[]'::jsonb,
  output_paths jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  usage jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_usage_monthly (
  studio_id uuid not null references public.studios(id) on delete cascade,
  month date not null,
  images_generated integer not null default 0 check (images_generated >= 0),
  updated_at timestamptz not null default now(),
  primary key(studio_id,month)
);

-- Indexes
create index if not exists portal_links_studio_idx on public.portal_links(studio_id);
create index if not exists references_order_idx on public.client_references(order_id,created_at desc);
create index if not exists gallery_order_idx on public.gallery_items(order_id,position,created_at);
create index if not exists gallery_studio_idx on public.gallery_items(studio_id);
create index if not exists gallery_selection_order_idx on public.gallery_selections(order_id);
create index if not exists client_payments_order_idx on public.client_payments(order_id,created_at desc);
create index if not exists client_payments_provider_idx on public.client_payments(provider_payment_id);
create index if not exists costs_order_idx on public.cost_entries(order_id,created_at desc);
create index if not exists templates_category_idx on public.shoot_templates(category,active,sort_order);
create index if not exists referrals_referrer_idx on public.referrals(referrer_studio_id,created_at desc);
create index if not exists ai_jobs_studio_created_idx on public.ai_generation_jobs(studio_id,created_at desc);
create index if not exists ai_jobs_order_idx on public.ai_generation_jobs(order_id);

-- updated_at triggers
create trigger portal_links_touch before update on public.portal_links for each row execute function public.touch_updated_at();
create trigger gallery_items_touch before update on public.gallery_items for each row execute function public.touch_updated_at();
create trigger gallery_selections_touch before update on public.gallery_selections for each row execute function public.touch_updated_at();
create trigger client_payments_touch before update on public.client_payments for each row execute function public.touch_updated_at();
create trigger shoot_templates_touch before update on public.shoot_templates for each row execute function public.touch_updated_at();

-- Seed marketplace
insert into public.shoot_templates(slug,title,category,description,premium,blueprint,sort_order) values
('15-anos-luxo','15 Anos Luxo','15 anos','Debutante elegante com direção premium, variação de planos e iluminação de estúdio.',false,'{"tipo":"15 anos","estilo":"Luxuoso","cenario":"Estúdio elegante","luz":"Softbox frontal + recorte","emocao":"confiança, delicadeza e celebração","shot_list":["retrato fechado","meio corpo","corpo inteiro","sentada editorial","detalhe de acessórios","movimento do vestido"]}',1),
('agro-natural','Agro Natural','Agro','Ensaio rural natural, fiel ao cliente e com estética comercial.',false,'{"tipo":"Agro","estilo":"Natural e elegante","cenario":"Campo / propriedade rural","luz":"Luz dourada de fim de tarde","emocao":"autenticidade, confiança e conexão com o campo","shot_list":["retrato no campo","caminhando","junto à cerca","close com chapéu","plano aberto rural","detalhe de botas/acessórios"]}',2),
('executivo-premium','Executivo Premium','Profissional','Retratos profissionais para empresários, políticos e posicionamento de autoridade.',true,'{"tipo":"Profissional","estilo":"Editorial","cenario":"Escritório minimalista","luz":"Janela suave + preenchimento","emocao":"autoridade, proximidade e confiança","shot_list":["headshot","meio corpo","sentado","em pé","braços cruzados","contexto de trabalho"]}',3),
('aniversario-baloes','Aniversário Balões','Aniversário','Ensaio comercial de aniversário com balões, bolo e variações de enquadramento.',false,'{"tipo":"Aniversário","estilo":"Natural e elegante","cenario":"Estúdio com balões","luz":"Softbox suave","emocao":"alegria, naturalidade e celebração","shot_list":["retrato com balões","corpo inteiro","com bolo","sentada","close sorrindo","detalhe decorativo"]}',4),
('plus-size-elegante','Plus Size Elegante','Feminino','Direção elegante com poses confortáveis, naturais e valorização real do biotipo.',true,'{"tipo":"Feminino","estilo":"Editorial","cenario":"Estúdio minimalista","luz":"Janela suave","emocao":"confiança, elegância e naturalidade","shot_list":["retrato frontal","3/4","sentada","em pé","movimento leve","close editorial"]}',5)
on conflict(slug) do update set title=excluded.title,category=excluded.category,description=excluded.description,premium=excluded.premium,blueprint=excluded.blueprint,sort_order=excluded.sort_order,active=true;

-- Feature defaults
create table if not exists public.feature_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.feature_settings(key,value) values
('ai_generation','{"enabled":true,"model":"gpt-image-2","max_per_request":4,"require_order":false}'::jsonb),
('referral_program','{"enabled":true,"reward_value":19.90,"qualification":"first_paid_subscription"}'::jsonb)
on conflict(key) do update set value=excluded.value,updated_at=now();
alter table public.feature_settings enable row level security;
create policy feature_settings_admin on public.feature_settings for all to authenticated using(private.is_platform_admin()) with check(private.is_platform_admin());
grant select,insert,update,delete on public.feature_settings to authenticated;

-- Storage: private media bucket
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('intorna-media','intorna-media',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- RLS
alter table public.portal_links enable row level security;
alter table public.client_references enable row level security;
alter table public.gallery_items enable row level security;
alter table public.gallery_selections enable row level security;
alter table public.client_payments enable row level security;
alter table public.cost_entries enable row level security;
alter table public.shoot_templates enable row level security;
alter table public.template_favorites enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.ai_generation_jobs enable row level security;
alter table public.ai_usage_monthly enable row level security;

create policy portal_links_all on public.portal_links for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy references_all on public.client_references for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy gallery_items_all on public.gallery_items for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy gallery_selections_all on public.gallery_selections for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy client_payments_read on public.client_payments for select to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy costs_all on public.cost_entries for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy templates_read on public.shoot_templates for select to authenticated using(active or private.is_platform_admin());
create policy templates_admin_insert on public.shoot_templates for insert to authenticated with check(private.is_platform_admin());
create policy templates_admin_update on public.shoot_templates for update to authenticated using(private.is_platform_admin()) with check(private.is_platform_admin());
create policy templates_admin_delete on public.shoot_templates for delete to authenticated using(private.is_platform_admin());
create policy template_favorites_all on public.template_favorites for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy referral_codes_read on public.referral_codes for select to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy referrals_read on public.referrals for select to authenticated using(private.is_platform_admin() or private.is_studio_member(referrer_studio_id) or private.is_studio_member(referred_studio_id));
create policy ai_jobs_all on public.ai_generation_jobs for all to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id)) with check(private.is_platform_admin() or private.is_studio_member(studio_id));
create policy ai_usage_read on public.ai_usage_monthly for select to authenticated using(private.is_platform_admin() or private.is_studio_member(studio_id));

-- API grants (RLS remains authoritative)
grant select,insert,update,delete on public.portal_links,public.client_references,public.gallery_items,public.gallery_selections,public.cost_entries,public.template_favorites,public.ai_generation_jobs to authenticated;
grant select on public.client_payments,public.referral_codes,public.referrals,public.ai_usage_monthly to authenticated;
grant select on public.shoot_templates to authenticated;

-- Storage policies: path begins with studio UUID (text), e.g. <studio_id>/orders/<order_id>/...
create policy intorna_media_select on storage.objects for select to authenticated using (
  bucket_id='intorna-media' and (storage.foldername(name))[1] in (
    select sm.studio_id::text from public.studio_members sm where sm.user_id=(select auth.uid()) and sm.active
  )
);
create policy intorna_media_insert on storage.objects for insert to authenticated with check (
  bucket_id='intorna-media' and (storage.foldername(name))[1] in (
    select sm.studio_id::text from public.studio_members sm where sm.user_id=(select auth.uid()) and sm.active
  )
);
create policy intorna_media_update on storage.objects for update to authenticated using (
  bucket_id='intorna-media' and (storage.foldername(name))[1] in (
    select sm.studio_id::text from public.studio_members sm where sm.user_id=(select auth.uid()) and sm.active
  )
) with check (
  bucket_id='intorna-media' and (storage.foldername(name))[1] in (
    select sm.studio_id::text from public.studio_members sm where sm.user_id=(select auth.uid()) and sm.active
  )
);
create policy intorna_media_delete on storage.objects for delete to authenticated using (
  bucket_id='intorna-media' and (storage.foldername(name))[1] in (
    select sm.studio_id::text from public.studio_members sm where sm.user_id=(select auth.uid()) and sm.active
  )
);

-- Prevent studio users from writing payment/referral/AI-usage ledgers directly; Edge Functions/service role own those writes.
revoke insert,update,delete on public.client_payments,public.referral_codes,public.referrals,public.ai_usage_monthly from authenticated;

