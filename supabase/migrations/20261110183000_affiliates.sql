-- Sistema de Afiliados — Fase 1.1 (2026-11-10): modelo de dados.
-- Plano aprovado pelo Renner em 2026-11-10 (piloto fechado com proteções).
--
-- Desenho:
-- * affiliates            — quem indica (YouTuber, parceiro etc.). Nasce
--                           'pending' e só indica depois de aprovado.
-- * affiliate_referrals   — o vínculo loja→afiliado. UNIQUE em store_id:
--                           uma loja tem no máximo UM afiliado, para sempre
--                           (sem troca de vínculo). A tabela stores NÃO é
--                           alterada (o schema é contrato entre 3 clientes).
-- * affiliate_payouts     — os lotes de pagamento (Pix) ao afiliado.
-- * affiliate_credits     — 1 crédito por mensalidade PAGA: nasce da fatura
--                           de mensalidade paga em financial_transactions
--                           (UNIQUE em financial_transaction_id = idempotência
--                           do motor de créditos, item 1.3). O crédito nasce
--                           'pending' e só libera 30 dias depois
--                           (release_at = earned_at + 30 dias), proteção
--                           contra estorno/chargeback.
--
-- Valores (espelhados em src/lib/affiliates.ts):
--   Essencial  → 100% da mensalidade paga (plan_kind 'essencial')
--   Somente PDV → 50% da mensalidade paga (plan_kind 'pdv')
--   Pagamento em lote, dia 5 ou 20 (escolha do afiliado), mínimo R$ 100.
--
-- Escrita é só do servidor (service_role) neste item: nenhuma policy de
-- INSERT/UPDATE para authenticated. As fases seguintes gravam via servidor
-- (cadastro grava o vínculo; o motor de créditos lê as faturas pagas).

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  name text,
  email text,
  document text,
  pix_key text,
  payout_day int not null default 5 check (payout_day in (5, 20)),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended')),
  referral_code text not null unique,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.affiliates is
  'Afiliados do programa de indicação: quem indica lojas e recebe a mensalidade das indicadas (Essencial 100%, Somente PDV 50%) enquanto a loja permanecer pagando.';

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  amount numeric(10, 2) not null,
  pix_key text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'paid', 'failed', 'cancelled')),
  scheduled_for date,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.affiliate_payouts is
  'Lotes de pagamento (Pix) aos afiliados: soma dos créditos liberados, paga no dia escolhido pelo afiliado (5 ou 20), com mínimo de R$ 100.';

create index if not exists affiliate_payouts_affiliate_status_idx
  on public.affiliate_payouts (affiliate_id, status);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  store_id uuid not null references public.stores (id) unique,
  source text not null default 'link'
    check (source in ('link', 'code', 'manual')),
  created_at timestamptz not null default now()
);

comment on table public.affiliate_referrals is
  'Vínculo permanente loja→afiliado criado no cadastro da loja (item 1.2). store_id UNIQUE: uma loja só tem um afiliado, sem troca.';

create index if not exists affiliate_referrals_affiliate_idx
  on public.affiliate_referrals (affiliate_id);

create table if not exists public.affiliate_credits (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  store_id uuid not null references public.stores (id),
  financial_transaction_id uuid not null
    references public.financial_transactions (id) unique,
  plan_kind text not null check (plan_kind in ('essencial', 'pdv')),
  base_amount numeric(10, 2) not null,
  rate_percent int not null,
  credit_amount numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'available', 'paid', 'cancelled')),
  earned_at timestamptz not null,
  release_at timestamptz not null,
  payout_id uuid references public.affiliate_payouts (id),
  created_at timestamptz not null default now()
);

comment on table public.affiliate_credits is
  'Créditos do afiliado: 1 por mensalidade paga (financial_transactions). Nasce pending e libera em release_at (earned_at + 30 dias); paid quando entra num lote de affiliate_payouts.';

create index if not exists affiliate_credits_affiliate_status_idx
  on public.affiliate_credits (affiliate_id, status);

create index if not exists affiliate_credits_status_release_idx
  on public.affiliate_credits (status, release_at);

-- RLS: leitura só do próprio afiliado; escrita só do servidor (service_role).
alter table public.affiliates enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_credits enable row level security;

drop policy if exists "affiliates_select_own" on public.affiliates;
create policy "affiliates_select_own"
  on public.affiliates for select
  using (user_id = (select auth.uid()));

drop policy if exists "affiliates_service_all" on public.affiliates;
create policy "affiliates_service_all"
  on public.affiliates for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "affiliate_payouts_select_own" on public.affiliate_payouts;
create policy "affiliate_payouts_select_own"
  on public.affiliate_payouts for select
  using (
    exists (
      select 1 from public.affiliates a
      where a.id = affiliate_payouts.affiliate_id
        and a.user_id = (select auth.uid())
    )
  );

drop policy if exists "affiliate_payouts_service_all" on public.affiliate_payouts;
create policy "affiliate_payouts_service_all"
  on public.affiliate_payouts for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "affiliate_referrals_select_own" on public.affiliate_referrals;
create policy "affiliate_referrals_select_own"
  on public.affiliate_referrals for select
  using (
    exists (
      select 1 from public.affiliates a
      where a.id = affiliate_referrals.affiliate_id
        and a.user_id = (select auth.uid())
    )
  );

drop policy if exists "affiliate_referrals_service_all" on public.affiliate_referrals;
create policy "affiliate_referrals_service_all"
  on public.affiliate_referrals for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "affiliate_credits_select_own" on public.affiliate_credits;
create policy "affiliate_credits_select_own"
  on public.affiliate_credits for select
  using (
    exists (
      select 1 from public.affiliates a
      where a.id = affiliate_credits.affiliate_id
        and a.user_id = (select auth.uid())
    )
  );

drop policy if exists "affiliate_credits_service_all" on public.affiliate_credits;
create policy "affiliate_credits_service_all"
  on public.affiliate_credits for all
  to service_role
  using (true)
  with check (true);
