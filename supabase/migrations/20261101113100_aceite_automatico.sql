-- Aceite automático de pedidos (configuração por loja:
-- stores.settings.auto_accept_orders = true).
--
-- Quando um pedido de delivery CHEGA ao status 'pendente' — no nascimento
-- (pagamento na entrega) ou na confirmação do pagamento online
-- ('aguardando_pagamento' -> 'pendente') — e a loja ligou o aceite
-- automático, o pedido avança sozinho para 'preparando', a mesma transição
-- que o botão "Aceitar pedido" faz via store_transition_order_status
-- (pendente -> preparando é a única transição replicada aqui).
--
-- Como o avanço é um UPDATE real em orders.status, o aviso de WhatsApp de
-- status (order-status-whatsapp, disparado por trigger no banco) sai
-- normalmente, igual ao aceite manual.
--
-- Pedidos de PDV (order_source = 'pdv') nunca são aceitos por aqui.

CREATE OR REPLACE FUNCTION public.auto_accept_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto boolean;
BEGIN
  IF NEW.status <> 'pendente' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_source = 'pdv' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((s.settings ->> 'auto_accept_orders')::boolean, false)
    INTO _auto
    FROM public.stores s
   WHERE s.id = NEW.store_id;

  IF NOT COALESCE(_auto, false) THEN
    RETURN NEW;
  END IF;

  -- O UPDATE dispara esta trigger de novo, mas com status 'preparando'
  -- (a guarda acima devolve sem agir) — sem recursão.
  UPDATE public.orders
     SET status = 'preparando'
   WHERE id = NEW.id
     AND status = 'pendente';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_accept_order ON public.orders;
CREATE TRIGGER trg_auto_accept_order
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_accept_order();
