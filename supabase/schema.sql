-- Execute no SQL Editor do Supabase (Dashboard > SQL).
-- Habilita RLS com políticas de leitura/escrita anônima para formulários abertos.

create table if not exists public.funil_organico_youtube (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  views_totais numeric not null check (views_totais >= 0),
  cliques_link numeric not null check (cliques_link >= 0),
  vendas numeric not null check (vendas >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.funil_pago_meta_vsl (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  valor_investido numeric not null check (valor_investido >= 0),
  chegada_lp numeric not null check (chegada_lp >= 0),
  taxa_reproducao_vsl numeric not null check (taxa_reproducao_vsl >= 0),
  taxa_retencao numeric not null check (taxa_retencao >= 0),
  cliques_cta numeric not null check (cliques_cta >= 0),
  chegada_checkout numeric not null check (chegada_checkout >= 0),
  conversao_checkout numeric not null check (conversao_checkout >= 0),
  vendas numeric not null check (vendas >= 0),
  custo_por_venda numeric not null check (custo_por_venda >= 0),
  roas numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.funil_pago_google_lp (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  valor_investido numeric not null check (valor_investido >= 0),
  chegada_lp numeric not null check (chegada_lp >= 0),
  taxa_conversao_lp numeric not null check (taxa_conversao_lp >= 0),
  chegada_checkout numeric not null check (chegada_checkout >= 0),
  conversao_checkout numeric not null check (conversao_checkout >= 0),
  vendas numeric not null check (vendas >= 0),
  custo_por_venda numeric not null check (custo_por_venda >= 0),
  roas numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.funil_webinario (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  valor_investido numeric not null check (valor_investido >= 0),
  taxa_inscricao numeric not null check (taxa_inscricao >= 0),
  taxa_presenca numeric not null check (taxa_presenca >= 0),
  permanencia_ate_pitch numeric not null check (permanencia_ate_pitch >= 0),
  cliques_cta numeric not null check (cliques_cta >= 0),
  conversao_checkout numeric not null check (conversao_checkout >= 0),
  vendas numeric not null check (vendas >= 0),
  custo_por_venda numeric not null check (custo_por_venda >= 0),
  roas numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.funil_organico_instagram (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  alcance_total numeric not null check (alcance_total >= 0),
  visitas_pagina numeric not null check (visitas_pagina >= 0),
  vendas numeric not null check (vendas >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.funil_organico_youtube_lowticket (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  views_totais numeric not null check (views_totais >= 0),
  visitas_lp numeric not null check (visitas_lp >= 0),
  vendas numeric not null check (vendas >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.funil_pago_lowticket (
  id uuid primary key default gen_random_uuid(),
  data_semana date not null,
  valor_investido numeric not null check (valor_investido >= 0),
  chegada_lp numeric not null check (chegada_lp >= 0),
  taxa_conversao_lp numeric not null check (taxa_conversao_lp >= 0),
  chegada_checkout numeric not null check (chegada_checkout >= 0),
  conversao_checkout numeric not null check (conversao_checkout >= 0),
  vendas numeric not null check (vendas >= 0),
  custo_por_venda numeric not null check (custo_por_venda >= 0),
  roas numeric not null,
  created_at timestamptz not null default now()
);

alter table public.funil_organico_youtube enable row level security;
alter table public.funil_pago_meta_vsl enable row level security;
alter table public.funil_pago_google_lp enable row level security;
alter table public.funil_webinario enable row level security;
alter table public.funil_organico_instagram enable row level security;
alter table public.funil_organico_youtube_lowticket enable row level security;
alter table public.funil_pago_lowticket enable row level security;

drop policy if exists "anon_select_funil_organico_youtube" on public.funil_organico_youtube;
drop policy if exists "anon_insert_funil_organico_youtube" on public.funil_organico_youtube;
drop policy if exists "anon_select_funil_pago_meta_vsl" on public.funil_pago_meta_vsl;
drop policy if exists "anon_insert_funil_pago_meta_vsl" on public.funil_pago_meta_vsl;
drop policy if exists "anon_select_funil_pago_google_lp" on public.funil_pago_google_lp;
drop policy if exists "anon_insert_funil_pago_google_lp" on public.funil_pago_google_lp;
drop policy if exists "anon_select_funil_webinario" on public.funil_webinario;
drop policy if exists "anon_insert_funil_webinario" on public.funil_webinario;
drop policy if exists "anon_select_funil_organico_instagram" on public.funil_organico_instagram;
drop policy if exists "anon_insert_funil_organico_instagram" on public.funil_organico_instagram;
drop policy if exists "anon_select_funil_organico_youtube_lowticket" on public.funil_organico_youtube_lowticket;
drop policy if exists "anon_insert_funil_organico_youtube_lowticket" on public.funil_organico_youtube_lowticket;
drop policy if exists "anon_select_funil_pago_lowticket" on public.funil_pago_lowticket;
drop policy if exists "anon_insert_funil_pago_lowticket" on public.funil_pago_lowticket;

create policy "anon_select_funil_organico_youtube" on public.funil_organico_youtube for select using (true);
create policy "anon_insert_funil_organico_youtube" on public.funil_organico_youtube for insert with check (true);

create policy "anon_select_funil_pago_meta_vsl" on public.funil_pago_meta_vsl for select using (true);
create policy "anon_insert_funil_pago_meta_vsl" on public.funil_pago_meta_vsl for insert with check (true);

create policy "anon_select_funil_pago_google_lp" on public.funil_pago_google_lp for select using (true);
create policy "anon_insert_funil_pago_google_lp" on public.funil_pago_google_lp for insert with check (true);

create policy "anon_select_funil_webinario" on public.funil_webinario for select using (true);
create policy "anon_insert_funil_webinario" on public.funil_webinario for insert with check (true);

create policy "anon_select_funil_organico_instagram" on public.funil_organico_instagram for select using (true);
create policy "anon_insert_funil_organico_instagram" on public.funil_organico_instagram for insert with check (true);

create policy "anon_select_funil_organico_youtube_lowticket" on public.funil_organico_youtube_lowticket for select using (true);
create policy "anon_insert_funil_organico_youtube_lowticket" on public.funil_organico_youtube_lowticket for insert with check (true);

create policy "anon_select_funil_pago_lowticket" on public.funil_pago_lowticket for select using (true);
create policy "anon_insert_funil_pago_lowticket" on public.funil_pago_lowticket for insert with check (true);
