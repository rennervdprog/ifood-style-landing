-- Trava de estoque do pedido manual (bug do catálogo, E2E 15/11/2026 — lacuna
-- do pedido manual).
--
-- O checkout trava saldo insuficiente dentro de create_order_with_items
-- (migration 20261116023000), mas o pedido manual
-- (PdvDeliveryManualDialog.tsx — componente único servindo o "Pedido manual"
-- do admin via ManualOrderFlow e o "Pedido Delivery Manual" do PDV) insere
-- orders + order_items direto do cliente, sem trava nenhuma: um produto com
-- saldo 0 era comprável pelo pedido manual (provado ao vivo na demo com o
-- Combo Casal, saldo 0, em 15/11/2026). Esta trigger BEFORE INSERT em
-- order_items fecha a lacuna com a MESMA semântica do checkout.
--
-- Escopo: SÓ pedidos order_source='manual'. Checkout (delivery), PDV (pdv) e
-- whatsapp_bot têm seus próprios caminhos e ficam fora: o PDV já trava no
-- saldo (Fase 2) e o checkout já tem a trava na RPC.
--
-- Semântica (espelho de create_order_with_items): bloqueia quando o produto
-- NÃO tem ficha técnica, NÃO é vendido por peso, TEM linha em product_stock,
-- track_stock=true e saldo < quantidade da linha. Sem linha de estoque ou
-- sem controle, vende normal. Pedido manual não tem pré-pedido (nasce
-- 'preparando', imediato) — a isenção de pré-pedido do checkout não se aplica.
--
-- Por que checar só a linha, sem somar linhas irmãs: o pedido manual nasce
-- 'preparando', então o trigger AFTER INSERT trg_order_item_decrement_stock
-- baixa cada linha logo após inseri-la — quando a linha seguinte é checada,
-- o saldo já reflete as baixas anteriores. Somar irmãs aqui contaria duas
-- vezes e barraria pedidos válidos (ex.: saldo 5, linhas 2+3). O FOR UPDATE
-- na linha de estoque serializa pedidos manuais concorrentes do mesmo
-- produto (a baixa ocorre na mesma instrução, via trigger AFTER).

CREATE OR REPLACE FUNCTION public.trg_check_manual_order_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source text;
  v_name text;
  v_sold_by_weight boolean;
  v_stock_qty numeric;
  v_stock_track boolean;
  v_effective numeric;
BEGIN
  -- Linha avulsa sem produto vinculado: só vale a trava de preço do trigger
  -- de validação (mesmo critério de validate_order_item_before_insert).
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.order_source INTO v_source
    FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND OR v_source IS DISTINCT FROM 'manual' THEN
    RETURN NEW;
  END IF;

  SELECT p.name, p.sold_by_weight INTO v_name, v_sold_by_weight
    FROM public.products p WHERE p.id = NEW.product_id;
  IF NOT FOUND THEN
    -- Produto inexistente: o trigger de validação já barra.
    RETURN NEW;
  END IF;

  -- Isenções idênticas às do checkout: ficha técnica baixa nos insumos
  -- (L-30) e produto por peso usa outra unidade.
  IF COALESCE(v_sold_by_weight, false) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_recipes WHERE product_id = NEW.product_id) THEN
    RETURN NEW;
  END IF;

  SELECT ps.quantity, ps.track_stock INTO v_stock_qty, v_stock_track
    FROM public.product_stock ps WHERE ps.product_id = NEW.product_id FOR UPDATE;
  IF FOUND AND v_stock_track IS TRUE THEN
    v_effective := public.stock_effective_sale_qty(NEW.product_id, NEW.quantity, NULL);
    IF COALESCE(v_stock_qty, 0) < v_effective THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('O produto %s está esgotado.', v_name);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_manual_order_out_of_stock ON public.order_items;
CREATE TRIGGER trg_block_manual_order_out_of_stock
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_manual_order_stock();

COMMENT ON FUNCTION public.trg_check_manual_order_stock() IS
  'Trava de estoque do pedido manual: mesma semântica de create_order_with_items, só para order_source=manual. Bloqueia a linha quando o produto tem controle de estoque e saldo < quantidade (sem ficha técnica e sem venda por peso). Checa só a linha: a baixa do trigger AFTER já refletiu as linhas anteriores.';

-- Função só-trigger: sem grant (padrão de hardening 20260820124000).
REVOKE EXECUTE ON FUNCTION public.trg_check_manual_order_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_check_manual_order_stock() TO service_role;
