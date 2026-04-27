-- Função para registrar transação de caixa automaticamente ao confirmar pedido
CREATE OR REPLACE FUNCTION public.handle_order_cash_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_cash_register_id UUID;
BEGIN
    -- Só registra se o pedido mudou para um status de 'confirmado' ou similar (ex: preparando, pronto, entregue)
    -- e se ainda não foi registrado (para evitar duplicidade se o status mudar várias vezes)
    IF (NEW.status IN ('preparando', 'pronto_para_entrega', 'saiu_entrega', 'entregue', 'finalizado')) 
       AND (OLD.status = 'pendente' OR OLD.status = 'aguardando_pagamento') THEN
        
        -- Busca o caixa aberto para esta loja
        SELECT id INTO v_cash_register_id 
        FROM public.cash_registers 
        WHERE store_id = NEW.store_id AND status = 'open' 
        LIMIT 1;

        -- Se houver um caixa aberto, registra a venda
        IF v_cash_register_id IS NOT NULL THEN
            INSERT INTO public.cash_transactions (
                cash_register_id,
                type,
                category,
                amount,
                description,
                payment_method,
                order_id,
                created_by
            ) VALUES (
                v_cash_register_id,
                'in',
                'sale',
                NEW.total_price,
                'Venda Pedido #' || SUBSTRING(NEW.id::text, 1, 8),
                NEW.payment_method,
                NEW.id,
                NEW.client_id -- Usamos o client_id como referência de quem gerou a transação (sistema)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para monitorar mudanças no status do pedido
DROP TRIGGER IF EXISTS on_order_confirmed_cash_transaction ON public.orders;
CREATE TRIGGER on_order_confirmed_cash_transaction
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cash_transaction();
