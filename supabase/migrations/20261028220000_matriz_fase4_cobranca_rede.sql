-- Fase 4 — Cobrança da rede (plano 28/10/2026, seção 4.4, Decisões 1, 2 e 6).
--
-- O QUE MUDA (só estrutura + funções; NENHUM dado existente é alterado):
--   1. store_networks ganha o controle da cobrança da rede:
--      - billing_enabled (default false): a cobrança da rede SÓ acontece
--        para redes com a flag ligada. Sem flag, monthly-billing se comporta
--        EXATAMENTE como hoje (nenhuma cobrança viva muda com esta migration).
--      - next_billing_date / last_billing_attempt_at: o mesmo par que
--        store_plans já usa (vencimento + trava anti-duplicata de 20h).
--   2. calculate_network_monthly_fee(_network_id) — a regra da Decisão 1
--      num só lugar (o front já a espelha em calcNetworkMonthlyFee, e a
--      edge monthly-billing passa a chamá-la):
--        base = preço do plano da rede (plan_templates ativo; sem template
--               ativo, cai para store_networks.monthly_fee);
--        extras = R$ 39,90 por subloja de delivery além das 3 primeiras;
--        gratuidade: GMV 60d das sublojas <= R$ 5.000 → total 0.
--      Contam como subloja de delivery: status 'ativo' (publicada),
--      não-matriz, e NÃO só-PDV. Só-PDV não conta nos 3 grátis nem paga
--      os R$ 39,90 (Decisão 6) — mas continua pagando os seus R$ 120/mês
--      no próprio plano, pela cobrança por loja (a edge não pula pdv_only).
--      O GMV soma total_price dos pedidos 'entregue'/'finalizado' dos
--      últimos 60 dias de TODAS as sublojas (PDV conta — Decisão 11).
--   3. settle_network_monthly_payment(_transaction_id) — liquidação da
--      cobrança da rede, espelhando settle_monthly_subscription_payment:
--      marca a transação como paga (idempotente) e avança o vencimento da
--      rede em 30 dias. O webhook a chama SÓ para transações com
--      metadata.charge_family = 'network_monthly_subscription'.
--   4. Fim dos 3 defaults conflitantes (achado C4) — SÓ para linhas novas:
--      o default de store_networks.monthly_fee vai de R$ 180 (nenhum plano
--      custa isso) para R$ 89,90 (Essencial, igual ao plan_templates).
--      NENHUMA linha existente é reescrita: a base agora vem do template
--      do plano, então o valor guardado só vale como fallback para planos
--      sem template ativo (ex.: commission_only da Graal, R$ 0).
--      O default 90 da RPC register_as_matriz e o 0 passado pelo cadastro
--      ficam como resíduo inofensivo para planos com template — redefinir
--      a RPC inteira só para trocar o default seria um diff grande sem
--      efeito prático; ver "pendente" abaixo.
--
-- DIVERGÊNCIAS PLANO x REALIDADE (conferido no banco ao vivo em
-- 28/10/2026, SÓ leitura — nada aqui migra dado):
--   - Duda lanches: JÁ REMOVIDA na Fase 0. Não há nada para migrar.
--   - Maristela / Graal: as 2 redes vivas NÃO são tocadas. Ao vivo hoje:
--     Graal (commission_only, R$ 0) tem 1 loja, a matriz Maristela, e
--     ZERO sublojas; "Rede Maristela" (fixed, R$ 90) não tem nenhuma loja
--     (matriz_store_id NULL). Ou seja: não existe subloja real para
--     migrar, e a cobrança da rede, quando ligada, não muda nenhum valor
--     vivo até que uma rede ganhe sublojas publicadas.
--   - Planos de teste: a limpeza das Fases 0/3 já os removeu da vitrine e
--     das redes; nenhum plano de teste aparece em rede ao vivo hoje.
--   - ATENÇÃO (efeito de ligar a flag na Graal, a confirmar com o Renner
--     antes de qualquer ativação): a loja-matriz Maristela tem hoje um
--     plano próprio ativo fixed R$ 89,90 (vencimento 2026-11-04). Pela
--     regra do plano ("a matriz, como página-guia que não vende, também
--     não tem plano próprio"), ligar billing_enabled na Graal ZERA essa
--     mensalidade da guia e passa a cobrar a rede (base R$ 0, Comissão).
--     A flag desligada mantém a cobrança de hoje — por isso a flag existe.
--
-- PENDENTES DO RENNER (não inventados aqui — ver relatório do PR):
--   P1. Rede Somente PDV: o plano lista R$ 120 como mensalidade da rede,
--       mas cada unidade só-PDV já paga R$ 120 no próprio plano. A RPC
--       abaixo segue a tabela do plano (base R$ 120) — se a intenção for
--       "rede PDV não tem base, só as lojas pagam", falta uma palavra dele.
--   P2. Preço VIP de rede: com a regra template-primeiro, um monthly_fee
--       guardado diferente do template NÃO vence (ex.: rede fixed com
--       monthly_fee 90 passa a cobrar 89,90). Se VIP de rede precisar
--       existir, falta uma coluna de override (ex.: monthly_fee_override).
--   P3. Rede sem loja-matriz (caso da "Rede Maristela" ao vivo, com
--       matriz_store_id NULL): a edge pula a cobrança (sem âncora para a
--       transação financeira). Nada a fazer até a rede ganhar uma matriz.
--
-- NÃO TOCA em repasse (continua por subloja, R$ 0,99/entrega, segundas).
-- NÃO altera, apaga ou migra nenhuma linha existente.

-- ---------------------------------------------------------------------------
-- 1. Colunas de cobrança em store_networks (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'billing_enabled') THEN
    ALTER TABLE public.store_networks ADD COLUMN billing_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'next_billing_date') THEN
    ALTER TABLE public.store_networks ADD COLUMN next_billing_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'last_billing_attempt_at') THEN
    ALTER TABLE public.store_networks ADD COLUMN last_billing_attempt_at timestamptz;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Default da mensalidade guardada: R$ 180 -> R$ 89,90 (só linhas novas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_networks
  ALTER COLUMN monthly_fee SET DEFAULT 89.90;

COMMENT ON COLUMN public.store_networks.billing_enabled IS
  'Fase 4: a cobrança da rede (monthly-billing) só cobra redes com esta flag ligada. Default false = cobrança viva inalterada.';
COMMENT ON COLUMN public.store_networks.next_billing_date IS
  'Fase 4: vencimento da mensalidade da rede (avançado 30 dias na liquidação, como store_plans).';
COMMENT ON COLUMN public.store_networks.monthly_fee IS
  'Fase 4: fallback da base da mensalidade para planos sem template ativo (ex.: commission_only). Com template ativo, a base vem de plan_templates.monthly_fee.';

-- ---------------------------------------------------------------------------
-- 3. calculate_network_monthly_fee — Decisões 1, 2 e 6 num só lugar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_network_monthly_fee(_network_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  _network record;
  _base numeric;
  _delivery_count int := 0;
  _pdv_only_count int := 0;
  _gmv numeric := 0;
  _extra_count int := 0;
  _extra_fee numeric := 0;
  _free boolean := false;
  _total numeric := 0;
BEGIN
  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  -- Base: preço do plano no template ativo; sem template, o valor guardado.
  SELECT pt.monthly_fee INTO _base
    FROM public.plan_templates pt
   WHERE pt.plan_type = _network.plan_type AND COALESCE(pt.is_active, true) = true
   ORDER BY pt.sort_order NULLS LAST
   LIMIT 1;
  IF _base IS NULL THEN
    _base := COALESCE(_network.monthly_fee, 0);
  END IF;

  -- Sublojas publicadas (status 'ativo', não-matriz). Rascunho ('analise')
  -- e pausada fora da vitrine não entram na conta de extras.
  SELECT COUNT(*) INTO _delivery_count
    FROM public.stores s
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND s.status = 'ativo'
     AND NOT (
       COALESCE(s.plan_type::text, '') = 'pdv_only'
       OR EXISTS (SELECT 1 FROM public.store_plans sp
                   WHERE sp.store_id = s.id AND sp.is_active = true
                     AND sp.plan_type = 'pdv_only')
     );
  SELECT COUNT(*) INTO _pdv_only_count
    FROM public.stores s
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND s.status = 'ativo'
     AND (
       COALESCE(s.plan_type::text, '') = 'pdv_only'
       OR EXISTS (SELECT 1 FROM public.store_plans sp
                   WHERE sp.store_id = s.id AND sp.is_active = true
                     AND sp.plan_type = 'pdv_only')
     );

  -- GMV 60 dias de TODAS as sublojas (PDV conta — sem filtro de origem).
  SELECT COALESCE(SUM(o.total_price), 0) INTO _gmv
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND o.status IN ('entregue', 'finalizado')
     AND o.created_at >= now() - interval '60 days';

  _free := _gmv <= 5000;
  _extra_count := GREATEST(0, _delivery_count - 3);
  _extra_fee := _extra_count * 39.90;
  _total := CASE WHEN _free THEN 0 ELSE _base + _extra_fee END;

  RETURN jsonb_build_object(
    'network_id', _network_id,
    'plan_type', _network.plan_type,
    'base_monthly_fee', _base,
    'delivery_unit_count', _delivery_count,
    'pdv_only_unit_count', _pdv_only_count,
    'free_units_included', 3,
    'extra_unit_count', _extra_count,
    'extra_unit_fee', 39.90,
    'extra_fee', _extra_fee,
    'gmv_60d', _gmv,
    'free_gmv_threshold', 5000,
    'free_by_gmv', _free,
    'total_monthly_fee', _total
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_network_monthly_fee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_network_monthly_fee(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. settle_network_monthly_payment — liquidação da cobrança da rede
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_network_monthly_payment(
  _transaction_id uuid,
  _settled_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  already_applied boolean,
  network_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tx public.financial_transactions%ROWTYPE;
  v_network_id uuid;
  v_settled_at timestamptz;
  v_marker text;
BEGIN
  IF _transaction_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id é obrigatório';
  END IF;

  SELECT * INTO v_tx
    FROM public.financial_transactions AS ft
   WHERE ft.id = _transaction_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF v_tx.transaction_kind <> 'commission_charge'::public.financial_transaction_type
     OR COALESCE(v_tx.metadata ->> 'charge_family', '') <> 'network_monthly_subscription' THEN
    RAISE EXCEPTION 'A transação não é uma mensalidade de rede';
  END IF;

  v_network_id := (v_tx.metadata ->> 'network_id')::uuid;
  IF v_network_id IS NULL THEN
    RAISE EXCEPTION 'Transação de rede sem network_id no metadata';
  END IF;

  v_marker := COALESCE(v_tx.metadata ->> 'monthly_settlement_applied_at', '');
  IF v_tx.status = 'paid' AND v_marker <> '' THEN
    RETURN QUERY SELECT true, v_network_id;
    RETURN;
  END IF;

  v_settled_at := COALESCE(v_tx.settled_at, _settled_at, now());

  UPDATE public.store_networks AS sn
     SET next_billing_date = v_settled_at + interval '30 days',
         last_billing_attempt_at = NULL,
         updated_at = now()
   WHERE sn.id = v_network_id;

  UPDATE public.financial_transactions AS ft
     SET status = 'paid',
         settled_at = v_settled_at,
         metadata = COALESCE(ft.metadata, '{}'::jsonb) || jsonb_build_object(
           'monthly_settlement_applied_at', v_settled_at
         )
   WHERE ft.id = v_tx.id;

  RETURN QUERY SELECT false, v_network_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.settle_network_monthly_payment(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_network_monthly_payment(uuid, timestamptz) TO service_role;
