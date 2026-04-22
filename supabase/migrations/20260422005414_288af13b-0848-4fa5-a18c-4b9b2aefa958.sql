
-- 1) Marca ItaSuper Pizzaria como loja REAL (não-teste)
UPDATE public.stores
SET is_test = false
WHERE id = 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5';

-- 2) Backfill: acumula taxa de R$2 por entrega para todos os pedidos finalizados
-- de lojas com plano fixo, entrega própria, pagamento físico e delivery_fee > 0
-- que ainda não foram contabilizados.
-- Estratégia: somar (qtd_pedidos_elegiveis * R$2) e adicionar ao repasse_pendente da loja.

DO $$
DECLARE
  _r RECORD;
  _split numeric;
  _qty integer;
  _total numeric;
BEGIN
  FOR _r IN 
    SELECT s.id AS store_id
    FROM public.stores s
    JOIN public.store_plans sp ON sp.store_id = s.id
    WHERE sp.plan_type = 'fixed'
      AND sp.is_active = true
      AND s.delivery_mode = 'own'
      AND COALESCE(s.is_test, false) = false
  LOOP
    _split := public.get_fixed_plan_platform_split(_r.store_id);
    IF _split <= 0 THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO _qty
    FROM public.orders o
    WHERE o.store_id = _r.store_id
      AND o.status = 'finalizado'
      AND COALESCE(o.delivery_fee, 0) > 0
      AND COALESCE(o.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');

    IF _qty = 0 THEN CONTINUE; END IF;

    _total := _qty * _split;

    -- Subtrai o que já foi pago/cobrado em financial_transactions (platform_delivery_fee)
    DECLARE
      _already_charged numeric;
      _already_pending numeric;
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO _already_charged
      FROM public.financial_transactions
      WHERE store_id = _r.store_id
        AND transaction_kind::text = 'platform_delivery_fee'
        AND status IN ('paid', 'pending');

      SELECT COALESCE(repasse_pendente, 0) INTO _already_pending
      FROM public.store_balances WHERE store_id = _r.store_id;

      -- Se total devido > já cobrado + já pendente, adiciona a diferença
      IF _total > (_already_charged + _already_pending) THEN
        DECLARE _delta numeric := _total - (_already_charged + _already_pending);
        BEGIN
          INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
          VALUES (_r.store_id, 0, 0, _delta, now())
          ON CONFLICT (store_id) DO UPDATE SET
            repasse_pendente = COALESCE(store_balances.repasse_pendente, 0) + _delta,
            updated_at = now();
          RAISE NOTICE 'Backfilled store=% qty=% total=% delta=%', _r.store_id, _qty, _total, _delta;
        END;
      END IF;
    END;
  END LOOP;
END $$;
