-- Sistema de Afiliados — Fase 1.3 (2026-11-10): motor de créditos.
--
-- Quando uma fatura de mensalidade é baixada como PAGA em
-- financial_transactions e a loja tem vínculo com um afiliado APROVADO,
-- nasce o crédito do afiliado em affiliate_credits (item 1.1): status
-- 'pending', liberando 30 dias depois (release_at = earned_at + 30 dias).
--
-- Decisões (validadas no schema vivo em 2026-11-10):
-- * Guarda da fatura: transaction_kind='commission_charge' +
--   metadata.charge_family='monthly_subscription' + reference_code
--   '#MENS-%' ou '#ASSIN-%' — o mesmo reconhecimento de mensalidade que
--   o restante do sistema usa.
-- * Base do crédito = amount DA FATURA — nunca o preço de tabela nem
--   store_plans.monthly_fee: há planos custom em produção (R$ 9, R$ 69,
--   R$ 130). Arredondamento igual ao da lib (src/lib/affiliates.ts):
--   round(amount * rate / 100, 2).
-- * plan_kind pela linha de store_plans da loja (na prática há 1 linha
--   por loja; vale a mais recente): 'pdv_only' → 'pdv' (50%); qualquer
--   outra → 'essencial' (100%). Sem linha de plano, cai em 'essencial'.
-- * earned_at = coalesce(settled_at, updated_at): settled_at é a coluna
--   que a baixa preenche (provado na fatura #MENS paga real: settled_at
--   = instante da baixa), e updated_at é mantido pelo trigger
--   trg_touch_financial_transactions_updated_at nas rotas que não
--   preenchem settled_at (10 das 27 faturas pagas não têm settled_at).
-- * Idempotência: UNIQUE(financial_transaction_id) + ON CONFLICT. Se o
--   crédito estava 'cancelled' (estorno anterior), um novo pagamento da
--   mesma fatura o reativa como 'pending' (fluxo da baixa manual
--   corrigida); crédito vivo (pending/available/paid) nunca é alterado
--   por um replay.
-- * Estorno: fatura que SAI de 'paid' para 'cancelled'/'failed' cancela
--   o crédito 'pending'/'available'. Crédito já 'paid' (pago ao
--   afiliado) NÃO é tocado: o clawback por saldo negativo entra na fase
--   de pagamentos.
-- * As funções são SECURITY DEFINER para a escrita em affiliate_credits
--   não depender de quem baixou a fatura (webhook em service_role, admin
--   em authenticated etc.): a RLS da tabela não tem policy de INSERT
--   para authenticated, e uma falha aqui quebraria a própria baixa.
--
-- Agendamento da liberação (rodar UMA vez, na aplicação desta migration —
-- os jobs recorrentes do projeto são gerenciados na aplicação, não em
-- migration; exceção histórica: 20260814004500):
--   SELECT cron.schedule(
--     'affiliate-release-credits-daily',
--     '20 3 * * *',
--     $$SELECT public.release_due_affiliate_credits();$$
--   );

CREATE OR REPLACE FUNCTION public.affiliate_credit_from_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_affiliate_id uuid;
  v_plan_kind text;
  v_rate_percent int;
  v_earned_at timestamptz;
BEGIN
  -- Só a TRANSIÇÃO para 'paid': INSERT já pago, ou UPDATE vindo de
  -- outro status. UPDATE paid→paid não é transição (a WHEN da trigger
  -- de UPDATE já filtra; esta checagem é a segunda trava).
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Guarda: é fatura de mensalidade?
  IF NEW.transaction_kind <> 'commission_charge'
     OR coalesce(NEW.metadata ->> 'charge_family', '') <> 'monthly_subscription'
     OR NOT (NEW.reference_code LIKE '#MENS-%' OR NEW.reference_code LIKE '#ASSIN-%') THEN
    RETURN NEW;
  END IF;

  -- A loja tem vínculo com afiliado APROVADO?
  SELECT r.affiliate_id
    INTO v_affiliate_id
  FROM public.affiliate_referrals r
  JOIN public.affiliates a ON a.id = r.affiliate_id
  WHERE r.store_id = NEW.store_id
    AND a.status = 'approved';

  IF v_affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tipo de plano pela linha de store_plans da loja (a mais recente).
  SELECT CASE WHEN sp.plan_type = 'pdv_only' THEN 'pdv' ELSE 'essencial' END,
         CASE WHEN sp.plan_type = 'pdv_only' THEN 50 ELSE 100 END
    INTO v_plan_kind, v_rate_percent
  FROM public.store_plans sp
  WHERE sp.store_id = NEW.store_id
  ORDER BY sp.created_at DESC
  LIMIT 1;

  IF v_plan_kind IS NULL THEN
    v_plan_kind := 'essencial';
    v_rate_percent := 100;
  END IF;

  v_earned_at := coalesce(NEW.settled_at, NEW.updated_at, now());

  INSERT INTO public.affiliate_credits (
    affiliate_id, store_id, financial_transaction_id, plan_kind,
    base_amount, rate_percent, credit_amount, status, earned_at, release_at
  ) VALUES (
    v_affiliate_id, NEW.store_id, NEW.id, v_plan_kind,
    NEW.amount, v_rate_percent, round(NEW.amount * v_rate_percent / 100, 2),
    'pending', v_earned_at, v_earned_at + interval '30 days'
  )
  ON CONFLICT (financial_transaction_id) DO UPDATE
    SET status = 'pending',
        plan_kind = EXCLUDED.plan_kind,
        base_amount = EXCLUDED.base_amount,
        rate_percent = EXCLUDED.rate_percent,
        credit_amount = EXCLUDED.credit_amount,
        earned_at = EXCLUDED.earned_at,
        release_at = EXCLUDED.release_at
    WHERE public.affiliate_credits.status = 'cancelled';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_affiliate_credit_on_insert_paid ON public.financial_transactions;
CREATE TRIGGER trg_affiliate_credit_on_insert_paid
  AFTER INSERT ON public.financial_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.affiliate_credit_from_paid_invoice();

DROP TRIGGER IF EXISTS trg_affiliate_credit_on_update_paid ON public.financial_transactions;
CREATE TRIGGER trg_affiliate_credit_on_update_paid
  AFTER UPDATE OF status ON public.financial_transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'paid' AND NEW.status = 'paid')
  EXECUTE FUNCTION public.affiliate_credit_from_paid_invoice();

CREATE OR REPLACE FUNCTION public.affiliate_credit_cancel_on_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Crédito já pago ao afiliado ('paid') não é tocado aqui: o estorno
  -- dele vira saldo negativo na fase de pagamentos (clawback).
  UPDATE public.affiliate_credits
     SET status = 'cancelled'
   WHERE financial_transaction_id = NEW.id
     AND status IN ('pending', 'available');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_affiliate_credit_on_reversal ON public.financial_transactions;
CREATE TRIGGER trg_affiliate_credit_on_reversal
  AFTER UPDATE OF status ON public.financial_transactions
  FOR EACH ROW
  WHEN (OLD.status = 'paid' AND NEW.status IN ('cancelled', 'failed'))
  EXECUTE FUNCTION public.affiliate_credit_cancel_on_reversal();

CREATE OR REPLACE FUNCTION public.release_due_affiliate_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_released integer := 0;
BEGIN
  WITH moved AS (
    UPDATE public.affiliate_credits
       SET status = 'available'
     WHERE status = 'pending'
       AND release_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_released FROM moved;

  RETURN v_released;
END;
$function$;

REVOKE ALL ON FUNCTION public.release_due_affiliate_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_due_affiliate_credits() TO service_role;

COMMENT ON FUNCTION public.affiliate_credit_from_paid_invoice() IS
  'Motor de créditos do afiliado (item 1.3): fatura de mensalidade paga + loja vinculada a afiliado aprovado = crédito pending com liberação em 30 dias.';
COMMENT ON FUNCTION public.affiliate_credit_cancel_on_reversal() IS
  'Estorno da mensalidade (item 1.3): fatura que sai de paid para cancelled/failed cancela o crédito pending/available; crédito paid não é tocado (clawback fica para a fase de pagamentos).';
COMMENT ON FUNCTION public.release_due_affiliate_credits() IS
  'Liberação dos créditos de afiliado (item 1.3): vira pending→available os créditos com release_at vencido e retorna quantos liberou. Agendar via pg_cron (SQL no cabeçalho da migration 20261110210000).';
