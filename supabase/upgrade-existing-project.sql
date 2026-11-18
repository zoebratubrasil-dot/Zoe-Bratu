-- Maison Privé — atualização aditiva para projeto Supabase já existente
-- Execute no SQL Editor depois de revisar. Não apaga nem recria tabelas ou registros.

begin;

-- Campos adicionados pela versão atual do Maison Privé.
alter table public.creator_profile
  add column if not exists whatsapp_number text default '',
  add column if not exists admin_email text,
  add column if not exists video_call_plans jsonb,
  add column if not exists about_section jsonb,
  add column if not exists mimo_config jsonb;

alter table public.fans
  add column if not exists welcome_email_sent_at timestamptz;

-- Log de e-mails de boas-vindas usado pelo painel administrativo.
create table if not exists public.welcome_email_logs (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid references public.fans(id) on delete set null,
  fan_email text not null,
  trigger_source text not null
    check (trigger_source in ('signup', 'first_purchase', 'manual_test')),
  provider text not null default 'supabase_edge',
  status text not null
    check (status in ('sent', 'skipped', 'pending_config', 'failed')),
  edge_response text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_welcome_email_logs_email_created
  on public.welcome_email_logs (fan_email, created_at desc);

alter table public.welcome_email_logs enable row level security;

-- Aceita os quatro tipos de venda reconhecidos pela versão atual do app.
alter table public.sales
  drop constraint if exists sales_sale_type_check;

alter table public.sales
  add constraint sales_sale_type_check
  check (sale_type in ('vip_subscription', 'ppv', 'tip', 'video_call'));

commit;
