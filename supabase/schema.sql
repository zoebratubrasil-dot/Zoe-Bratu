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
  sale_type text not null check (sale_type in ('vip_subscription', 'ppv', 'tip')),
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
