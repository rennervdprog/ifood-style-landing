-- Tempo real do acompanhamento guest (/p/:orderId).
-- Quem tem conta recebe o status na hora via postgres_changes; o guest
-- não tem login e a tela pública só consultava a função a cada 20s.
-- Este gatilho publica um broadcast PÚBLICO por pedido quando o status
-- muda. O aviso carrega SÓ o status novo — os dados do pedido continuam
-- vindo da função guest-order-status, protegida pelos últimos 4 dígitos
-- do WhatsApp. O tópico usa o UUID do pedido (não adivinhável).
-- Uma falha no aviso NUNCA pode travar a mudança de status do pedido:
-- por isso o EXCEPTION interno (é um canal lateral de notificação).
CREATE OR REPLACE FUNCTION public.notify_guest_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('status', NEW.status),
      'status_changed',
      'guest-order:' || NEW.id::text,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_guest_order_status falhou p/ o pedido %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_guest_order_status ON public.orders;
CREATE TRIGGER trg_notify_guest_order_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_guest_order_status();
