-- Sistema de Afiliados — Fase 3 (2026-11-11): aba de afiliados no
-- super-admin (cadastros, "a pagar" e registro de pagamentos).
--
-- O que esta migration faz:
-- 1. Colunas de rastro:
--    * affiliates.approved_at — quando o cadastro foi aprovado pelo admin.
--    * affiliate_credits.compensated_at / compensated_payout_id — o
--      rastro do clawback: crédito já PAGO ao afiliado cuja fatura foi
--      estornada depois (cancelled/failed) e cujo valor já foi descontado
--      de um lote posterior. O crédito CONTINUA 'paid' (ele foi pago de
--      verdade; o histórico não se apaga nem se reescreve) — a compensação
--      é um evento separado, ligado ao payout que a absorveu.
-- 2. Policies de LEITURA das 4 tabelas para o admin da plataforma
--    (is_platform_admin, o helper padrão do repo). Escrita continua
--    impossível por policy: toda escrita do super-admin passa pelas RPCs
--    abaixo, que checam o admin DENTRO da função.
-- 3. RPC admin_set_affiliate_status: aprovar / suspender / reativar.
--    Não existe status 'rejected' no desenho: cadastro recusado fica
--    'suspended' (bloqueado, sem indicar e sem receber) — decisão
--    registrada no PR da Fase 3.
-- 4. RPC admin_register_affiliate_payout: o registro do pagamento em
--    lote, ATÔMICO. O admin faz o Pix no banco e registra aqui. Em uma
--    transação só: trava a linha do afiliado, soma os créditos
--    'available' (bruto), subtrai os créditos 'paid' com fatura estornada
--    ainda não compensados ("a compensar"), exige líquido >= R$ 100
--    (AFFILIATE_MIN_PAYOUT de src/lib/affiliates.ts), cria o payout
--    'paid' com amount = LÍQUIDO (o que saiu de verdade no Pix), marca os
--    créditos do lote como 'paid' com payout_id e marca os compensados
--    com compensated_payout_id/compensated_at apontando para ESTE payout.
--    Sem dinheiro parcial: ou tudo acontece, ou nada.
--    Auditoria de um lote: bruto = soma dos créditos com payout_id = lote;
--    compensado = soma dos créditos com compensated_payout_id = lote;
--    bruto − compensado = affiliate_payouts.amount.
--
-- A matemática exibida na aba (src/lib/superAdminAfiliados.ts) é a MESMA
-- desta RPC — divergência tela×RPC é bug.
--
-- scheduled_for do payout = dia do lote vigente: a próxima ocorrência do
-- payout_day do afiliado a partir de hoje (fuso America/Sao_Paulo), a
-- mesma regra do nextPayoutDate do painel do afiliado (Fase 2).

-- ─── 1. Colunas de rastro ──────────────────────────────────────────────

alter table public.affiliates
  add column if not exists approved_at timestamptz;

comment on column public.affiliates.approved_at is
  'Quando o admin aprovou o cadastro (Fase 3); preenchido na transição pending→approved.';

alter table public.affiliate_credits
  add column if not exists compensated_at timestamptz;

alter table public.affiliate_credits
  add column if not exists compensated_payout_id uuid
    references public.affiliate_payouts (id);

comment on column public.affiliate_credits.compensated_payout_id is
  'Clawback (Fase 3): payout posterior que descontou este crédito já pago cuja fatura foi estornada. Preenchido = já compensado.';
comment on column public.affiliate_credits.compensated_at is
  'Quando a compensação do clawback aconteceu (junto de compensated_payout_id).';

create index if not exists affiliate_credits_compensate_idx
  on public.affiliate_credits (affiliate_id)
  where status = 'paid' and compensated_payout_id is null;

-- ─── 2. Leitura do admin da plataforma ─────────────────────────────────

drop policy if exists "affiliates_select_admin" on public.affiliates;
create policy "affiliates_select_admin"
  on public.affiliates for select
  using (public.is_platform_admin((select auth.uid())));

drop policy if exists "affiliate_referrals_select_admin" on public.affiliate_referrals;
create policy "affiliate_referrals_select_admin"
  on public.affiliate_referrals for select
  using (public.is_platform_admin((select auth.uid())));

drop policy if exists "affiliate_credits_select_admin" on public.affiliate_credits;
create policy "affiliate_credits_select_admin"
  on public.affiliate_credits for select
  using (public.is_platform_admin((select auth.uid())));

drop policy if exists "affiliate_payouts_select_admin" on public.affiliate_payouts;
create policy "affiliate_payouts_select_admin"
  on public.affiliate_payouts for select
  using (public.is_platform_admin((select auth.uid())));

-- ─── 3. Aprovar / suspender / reativar ─────────────────────────────────

create or replace function public.admin_set_affiliate_status(
  p_affiliate_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requester uuid := auth.uid();
  v_old_status text;
begin
  if v_requester is null or not public.is_platform_admin(v_requester) then
    raise exception 'Acesso restrito ao admin da plataforma.'
      using errcode = '42501';
  end if;

  -- Sem 'rejected' no desenho: os únicos destinos pela aba são
  -- 'approved' (aprovar/reativar) e 'suspended' (bloquear/recusar).
  if p_status is null or p_status not in ('approved', 'suspended') then
    raise exception 'Status inválido: use approved ou suspended.'
      using errcode = '22023';
  end if;

  select status into v_old_status
  from public.affiliates
  where id = p_affiliate_id
  for update;

  if not found then
    raise exception 'Afiliado não encontrado.' using errcode = 'P0002';
  end if;

  if v_old_status = p_status then
    return 'unchanged';
  end if;

  update public.affiliates
  set status = p_status,
      -- A aprovação fica registrada na transição pending→approved;
      -- reativar (suspended→approved) preserva a data original.
      approved_at = case
        when p_status = 'approved' and v_old_status = 'pending' then now()
        else approved_at
      end,
      updated_at = now()
  where id = p_affiliate_id;

  return 'ok';
end;
$function$;

revoke all on function public.admin_set_affiliate_status(uuid, text) from public;
revoke all on function public.admin_set_affiliate_status(uuid, text) from anon;
grant execute on function public.admin_set_affiliate_status(uuid, text)
  to authenticated, service_role;

comment on function public.admin_set_affiliate_status(uuid, text) is
  'Super-admin (Fase 3): aprova, suspende ou reativa um afiliado. Só admin da plataforma; pending→approved registra approved_at. Retorna ok/unchanged.';

-- ─── 4. Registro atômico do pagamento em lote ──────────────────────────

create or replace function public.admin_register_affiliate_payout(
  p_affiliate_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requester uuid := auth.uid();
  v_affiliate public.affiliates%rowtype;
  v_available_ids uuid[] := '{}';
  v_gross numeric(10, 2) := 0;
  v_compensate_ids uuid[] := '{}';
  v_offset numeric(10, 2) := 0;
  v_net numeric(10, 2) := 0;
  v_payout_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_scheduled_for date;
begin
  if v_requester is null or not public.is_platform_admin(v_requester) then
    raise exception 'Acesso restrito ao admin da plataforma.'
      using errcode = '42501';
  end if;

  -- Trava a linha do afiliado: dois registros simultâneos para o mesmo
  -- afiliado serializam aqui, e o segundo enxerga o resultado do primeiro.
  select * into v_affiliate
  from public.affiliates
  where id = p_affiliate_id
  for update;

  if not found then
    raise exception 'Afiliado não encontrado.' using errcode = 'P0002';
  end if;

  if v_affiliate.status <> 'approved' then
    raise exception 'Só afiliado aprovado recebe pagamento (status atual: %).',
      v_affiliate.status using errcode = '22023';
  end if;

  -- Os conjuntos são capturados por ID: a soma e a baixa usam EXATAMENTE
  -- as mesmas linhas, mesmo se outro processo liberar crédito no meio.
  select coalesce(array_agg(c.id), '{}'::uuid[]),
         coalesce(sum(c.credit_amount), 0)
    into v_available_ids, v_gross
  from public.affiliate_credits c
  where c.affiliate_id = p_affiliate_id
    and c.status = 'available';

  -- "A compensar": crédito já pago ao afiliado, fatura estornada depois
  -- (o motor da Fase 1 não toca crédito 'paid') e ainda não compensado.
  select coalesce(array_agg(c.id), '{}'::uuid[]),
         coalesce(sum(c.credit_amount), 0)
    into v_compensate_ids, v_offset
  from public.affiliate_credits c
  join public.financial_transactions ft
    on ft.id = c.financial_transaction_id
  where c.affiliate_id = p_affiliate_id
    and c.status = 'paid'
    and c.compensated_payout_id is null
    and ft.status in ('cancelled', 'failed');

  v_net := round(v_gross - v_offset, 2);

  -- Mínimo do programa: AFFILIATE_MIN_PAYOUT (src/lib/affiliates.ts).
  if v_net < 100 then
    raise exception
      'Líquido abaixo do mínimo de R$ 100 (liberado R$ %, a compensar R$ %, líquido R$ %).',
      v_gross, v_offset, v_net using errcode = '22023';
  end if;

  -- Dia do lote vigente (mesma regra do nextPayoutDate da Fase 2).
  v_scheduled_for := make_date(
    extract(year from v_today)::int,
    extract(month from v_today)::int,
    v_affiliate.payout_day
  );
  if v_scheduled_for < v_today then
    v_scheduled_for := (v_scheduled_for + interval '1 month')::date;
  end if;

  insert into public.affiliate_payouts (
    affiliate_id, amount, pix_key, status, scheduled_for, paid_at, note
  ) values (
    p_affiliate_id,
    v_net,
    v_affiliate.pix_key,
    'paid',
    v_scheduled_for,
    now(),
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_payout_id;

  -- Baixa dos créditos do lote (o conjunto exato somado acima).
  update public.affiliate_credits
  set status = 'paid',
      payout_id = v_payout_id
  where id = any (v_available_ids);

  -- Baixa da compensação: rastro no próprio crédito, apontando para o
  -- lote que absorveu o valor. Nada é apagado.
  update public.affiliate_credits
  set compensated_payout_id = v_payout_id,
      compensated_at = now()
  where id = any (v_compensate_ids);

  return jsonb_build_object(
    'payout_id', v_payout_id,
    'gross', v_gross,
    'offset', v_offset,
    'net', v_net,
    'credits_paid', coalesce(array_length(v_available_ids, 1), 0),
    'credits_compensated', coalesce(array_length(v_compensate_ids, 1), 0),
    'scheduled_for', v_scheduled_for
  );
end;
$function$;

revoke all on function public.admin_register_affiliate_payout(uuid, text) from public;
revoke all on function public.admin_register_affiliate_payout(uuid, text) from anon;
grant execute on function public.admin_register_affiliate_payout(uuid, text)
  to authenticated, service_role;

comment on function public.admin_register_affiliate_payout(uuid, text) is
  'Super-admin (Fase 3): registra o pagamento em lote ao afiliado de forma atômica — líquido = créditos available − créditos paid com fatura estornada não compensados; exige líquido >= R$ 100; cria o payout paid e baixa os dois conjuntos com rastro.';
