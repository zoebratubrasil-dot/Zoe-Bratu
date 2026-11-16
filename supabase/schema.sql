-- Maison Privé — Schema Completo para Supabase (Criadora Solo +18)
-- Execute este script no SQL Editor do seu projeto Supabase caso não use o provisionamento automático.

create extension if not exists pgcrypto;

-- 1. Perfil da Criadora Solo (registro único para a criadora)
create table if not exists public.creator_profile (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default 'solo',
  display_name text not null default 'Valentina Noir',
  handle text not null default '@valentinanoir',
  bio text not null default 'Ensaios autorais, bastidores íntimos e vídeos exclusivos em 4K. Conteúdo estritamente para maiores de 18 anos.',
  location text not null default 'São Paulo, Brasil',
  avatar_url text,
  hero_url text,
  vip_monthly_price_brl numeric(10,2) not null default 49.90,
  vip_description text not null default 'Acesso ilimitado a todos os ensaios e vídeos marcados como VIP, atualizações semanais e prioridade em pedidos.',
  pix_key text default '',
  admin_email text,
  video_call_plans jsonb,
  age_verified_18 boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2. Acervo de Conteúdo (Fotos e Vídeos enviados pela criadora)
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  media_type text not null check (media_type in ('photo', 'video')),
  access_tier text not null check (access_tier in ('free', 'vip', 'ppv')) default 'vip',
  price_brl numeric(10,2) not null default 0,
  collection_name text not null default 'Geral',
  storage_path text not null,
  media_url text not null,
  preview_url text,
  duration_seconds integer,
  file_size_bytes bigint,
  mime_type text,
  is_published boolean not null default true,
  views_count integer not null default 0,
  unlocks_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Fãs / Assinantes (+18)
create table if not exists public.fans (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  display_name text,
  is_vip boolean not null default false,
  vip_expires_at timestamptz,
  age_confirmed_18 boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. Banco de Vendas (Assinaturas VIP, Compras Avulsas PPV e Gorjetas)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid references public.fans(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  sale_type text not null check (sale_type in ('vip_subscription', 'ppv', 'tip', 'video_call')),
  media_id uuid references public.media_items(id) on delete set null,
  amount_brl numeric(10,2) not null,
  payment_method text not null default 'pix' check (payment_method in ('pix', 'card')),
  status text not null default 'paid' check (status in ('paid', 'pending', 'refunded')),
  external_ref text,
  created_at timestamptz not null default now()
);

-- 5. Conteúdos Desbloqueados por Fã (PPV)
create table if not exists public.unlocked_media (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid references public.fans(id) on delete cascade,
  buyer_email text not null,
  media_id uuid references public.media_items(id) on delete cascade not null,
  sale_id uuid references public.sales(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (buyer_email, media_id)
);

-- Índices para performance em consultas do banco de vendas e vitrine
create index if not exists idx_media_items_published_created on public.media_items (is_published, created_at desc);
create index if not exists idx_sales_created on public.sales (created_at desc);
create index if not exists idx_sales_buyer_email on public.sales (buyer_email);
create index if not exists idx_unlocked_media_email on public.unlocked_media (buyer_email);

-- Inserir perfil inicial da criadora solo caso não exista
insert into public.creator_profile (slug, display_name, handle)
values ('solo', 'Valentina Noir', '@valentinanoir')
on conflict (slug) do nothing;

-- Habilitar Row Level Security (RLS)
alter table public.creator_profile enable row level security;
alter table public.media_items enable row level security;
alter table public.fans enable row level security;
alter table public.sales enable row level security;
alter table public.unlocked_media enable row level security;

-- Políticas de leitura pública segura para perfil da criadora
drop policy if exists "Public can read creator profile" on public.creator_profile;
create policy "Public can read creator profile"
  on public.creator_profile for select
  using (true);

-- Nota: As operações administrativas de upload, vendas e desbloqueio são mediadas pelo servidor com service_role,
-- garantindo proteção das mídias pagas (VIP/PPV) antes da compra.

-- Buckets de Storage (caso executando no SQL Editor)
insert into storage.buckets (id, name, public)
values ('creator-media', 'creator-media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('creator-previews', 'creator-previews', true)
on conflict (id) do nothing;

-- Leitura pública apenas para prévias/capas e avatares
drop policy if exists "Public read previews" on storage.objects;
create policy "Public read previews"
  on storage.objects for select
  using (bucket_id = 'creator-previews');

-- 6. Rastreamento e Logs de E-mail de Boas-Vindas (Edge Function)
alter table public.fans
  add column if not exists welcome_email_sent_at timestamptz;

create table if not exists public.welcome_email_logs (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid references public.fans(id) on delete set null,
  fan_email text not null,
  trigger_source text not null check (trigger_source in ('signup', 'first_purchase', 'manual_test')),
  provider text not null default 'supabase_edge',
  status text not null check (status in ('sent', 'skipped', 'pending_config', 'failed')),
  edge_response text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_welcome_email_logs_email_created
  on public.welcome_email_logs (fan_email, created_at desc);

alter table public.welcome_email_logs enable row level security;

-- Trigger opcional via pg_net no Postgres para acionar a Edge Function welcome-fan-email diretamente do banco
create or replace function public.trg_dispatch_welcome_fan_email()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text := current_setting('app.settings.welcome_edge_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
  already_sent timestamptz;
  prior_sales integer := 0;
begin
  if edge_url is null or edge_url = '' then
    return new;
  end if;

  if tg_table_name = 'fans' then
    if new.welcome_email_sent_at is not null then
      return new;
    end if;
    perform net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(service_key, '')
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'fans',
        'record', to_jsonb(new)
      )
    );
  elsif tg_table_name = 'sales' then
    select count(*) into prior_sales
    from public.sales
    where buyer_email = new.buyer_email
      and id <> new.id;

    select welcome_email_sent_at into already_sent
    from public.fans
    where email = new.buyer_email
    limit 1;

    if prior_sales = 0 and already_sent is null then
      perform net.http_post(
        url := edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(service_key, '')
        ),
        body := jsonb_build_object(
          'type', 'INSERT',
          'table', 'sales',
          'record', to_jsonb(new)
        )
      );
    end if;
  end if;
  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists trg_welcome_new_fan on public.fans;
create trigger trg_welcome_new_fan
  after insert on public.fans
  for each row
  execute function public.trg_dispatch_welcome_fan_email();

drop trigger if exists trg_welcome_first_purchase on public.sales;
create trigger trg_welcome_first_purchase
  after insert on public.sales
  for each row
  execute function public.trg_dispatch_welcome_fan_email();

-- 7. Planos Editáveis de Vídeo Chamada (4 planos na vitrine pública)
alter table public.creator_profile
  add column if not exists video_call_plans jsonb;

do $$
begin
  alter table public.sales drop constraint if exists sales_sale_type_check;
  alter table public.sales add constraint sales_sale_type_check
    check (sale_type in ('vip_subscription', 'ppv', 'tip', 'video_call'));
exception
  when others then null;
end $$;

