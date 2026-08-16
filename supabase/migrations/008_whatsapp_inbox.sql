-- Intorná Pixels v7 — WhatsApp Inbox / Cloud API
create extension if not exists supabase_vault with schema vault;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null unique references public.studios(id) on delete cascade,
  provider text not null default 'meta_cloud_api',
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  waba_id text,
  phone_number_id text unique,
  display_phone_number text,
  business_name text,
  token_secret_id uuid,
  connected_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  wa_id text not null,
  phone text,
  profile_name text,
  avatar_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(studio_id,wa_id)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','pending','resolved','archived')),
  stage text not null default 'novo_lead',
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(studio_id,contact_id)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  provider_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  body text,
  status text not null default 'received',
  reply_to_provider_message_id text,
  media_id text,
  media_mime_type text,
  media_filename text,
  template_name text,
  sent_by uuid references auth.users(id) on delete set null,
  error_message text,
  raw jsonb not null default '{}'::jsonb,
  message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_quick_replies (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  title text not null,
  body text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_contacts_studio_last_idx on public.whatsapp_contacts(studio_id,last_seen_at desc);
create index if not exists whatsapp_contacts_client_idx on public.whatsapp_contacts(client_id);
create index if not exists whatsapp_conversations_studio_last_idx on public.whatsapp_conversations(studio_id,last_message_at desc nulls last);
create index if not exists whatsapp_conversations_order_idx on public.whatsapp_conversations(order_id);
create index if not exists whatsapp_messages_conversation_at_idx on public.whatsapp_messages(conversation_id,message_at);
create index if not exists whatsapp_messages_studio_at_idx on public.whatsapp_messages(studio_id,message_at desc);
create index if not exists whatsapp_quick_replies_studio_idx on public.whatsapp_quick_replies(studio_id,sort_order);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_quick_replies enable row level security;

-- Connection metadata can be read by owners/admins. Tokens never live in this table.
create policy whatsapp_connections_read on public.whatsapp_connections for select to authenticated
using (private.is_platform_admin() or private.is_studio_member(studio_id));
create policy whatsapp_connections_manage on public.whatsapp_connections for update to authenticated
using (private.can_manage_studio(studio_id)) with check (private.can_manage_studio(studio_id));

create policy whatsapp_contacts_all on public.whatsapp_contacts for all to authenticated
using (private.is_platform_admin() or private.is_studio_member(studio_id))
with check (private.is_platform_admin() or private.is_studio_member(studio_id));

create policy whatsapp_conversations_all on public.whatsapp_conversations for all to authenticated
using (private.is_platform_admin() or private.is_studio_member(studio_id))
with check (private.is_platform_admin() or private.is_studio_member(studio_id));

create policy whatsapp_messages_read on public.whatsapp_messages for select to authenticated
using (private.is_platform_admin() or private.is_studio_member(studio_id));
-- Outbound inserts go through Edge Function so status/message IDs remain server-controlled.

create policy whatsapp_quick_replies_all on public.whatsapp_quick_replies for all to authenticated
using (private.is_platform_admin() or private.is_studio_member(studio_id))
with check (private.is_platform_admin() or private.is_studio_member(studio_id));

-- Updated_at triggers.
drop trigger if exists whatsapp_connections_touch on public.whatsapp_connections;
create trigger whatsapp_connections_touch before update on public.whatsapp_connections for each row execute function public.touch_updated_at();
drop trigger if exists whatsapp_conversations_touch on public.whatsapp_conversations;
create trigger whatsapp_conversations_touch before update on public.whatsapp_conversations for each row execute function public.touch_updated_at();
drop trigger if exists whatsapp_quick_replies_touch on public.whatsapp_quick_replies;
create trigger whatsapp_quick_replies_touch before update on public.whatsapp_quick_replies for each row execute function public.touch_updated_at();

-- Service-role-only Vault helpers. Access tokens are encrypted by Supabase Vault.
create or replace function public.set_whatsapp_access_token(p_studio_id uuid, p_token text)
returns uuid language plpgsql security definer set search_path=public,vault as $$
declare v_id uuid; v_existing uuid;
begin
  select token_secret_id into v_existing from public.whatsapp_connections where studio_id=p_studio_id;
  if v_existing is null then
    select vault.create_secret(p_token, 'whatsapp_'||p_studio_id::text, 'WhatsApp Cloud API token for Intorna Pixels studio') into v_id;
  else
    perform vault.update_secret(v_existing, p_token, 'whatsapp_'||p_studio_id::text, 'WhatsApp Cloud API token for Intorna Pixels studio');
    v_id := v_existing;
  end if;
  insert into public.whatsapp_connections(studio_id,token_secret_id,status)
  values(p_studio_id,v_id,'pending')
  on conflict(studio_id) do update set token_secret_id=excluded.token_secret_id,updated_at=now();
  return v_id;
end $$;

create or replace function public.get_whatsapp_access_token(p_studio_id uuid)
returns text language sql stable security definer set search_path=public,vault as $$
  select ds.decrypted_secret
  from public.whatsapp_connections wc
  join vault.decrypted_secrets ds on ds.id=wc.token_secret_id
  where wc.studio_id=p_studio_id
  limit 1
$$;

revoke all on function public.set_whatsapp_access_token(uuid,text) from public,anon,authenticated;
revoke all on function public.get_whatsapp_access_token(uuid) from public,anon,authenticated;
grant execute on function public.set_whatsapp_access_token(uuid,text) to service_role;
grant execute on function public.get_whatsapp_access_token(uuid) to service_role;

-- Initial quick replies are created per studio lazily by the frontend/backend.

grant select on public.whatsapp_connections,public.whatsapp_contacts,public.whatsapp_conversations,public.whatsapp_messages,public.whatsapp_quick_replies to authenticated;
grant insert,update,delete on public.whatsapp_contacts,public.whatsapp_conversations,public.whatsapp_quick_replies to authenticated;
-- No authenticated direct write grant on whatsapp_messages/connections inserts.
