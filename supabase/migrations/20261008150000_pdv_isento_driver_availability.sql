-- Isenta vendas de balcão (PDV) da checagem de disponibilidade de entregador.
--
-- Contexto: o trigger trg_enforce_order_driver_availability (criado em
-- 20260818124500_unify_driver_delivery_availability.sql) rejeita QUALQUER
-- INSERT em orders com no_driver_available quando a loja (delivery_mode='own')
-- não tem entregador online — inclusive para order_source='pdv'.
-- Venda de balcão nunca envolve entrega, então a checagem não se aplica a ela.
-- Sem esta isenção, uma loja PDV sem entregador cadastrado não consegue
-- registrar nenhuma venda de balcão (bug verificado em produção em 2026-10-08:
-- INSERT mínimo em orders retorna P0001/no_driver_available).
-- Pedidos delivery continuam exigindo entregador disponível (inalterado).

CREATE OR REPLACE FUNCTION public.enforce_order_driver_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _availability record;
BEGIN
  -- Vendas de balcão (PDV) nunca precisam de entregador: isenta da checagem.
  IF COALESCE(NEW.order_source, '') = 'pdv' THEN
    RETURN NEW;
  END IF;

  -- O contrato existente marca retirada com bairro RETIRADA. Não se aplica a este fluxo.
  IF COALESCE(upper(trim(NEW.neighborhood)), '') = 'RETIRADA' THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO _availability
    FROM public.store_delivery_availability(NEW.store_id)
   LIMIT 1;

  IF COALESCE(_availability.can_accept_delivery_orders, false) = false THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'no_driver_available',
      DETAIL = COALESCE(_availability.reason_message, 'Esta loja está sem entregador disponível no momento.');
  END IF;

  RETURN NEW;
END;
$function$;
