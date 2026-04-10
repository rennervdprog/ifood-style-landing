
-- Create function to auto-insert system messages on order status change
CREATE OR REPLACE FUNCTION public.insert_order_status_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _msg text;
  _sender uuid;
  _store_owner uuid;
BEGIN
  -- Only trigger on actual status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get store owner for sender_id
  SELECT owner_id INTO _store_owner
  FROM public.stores
  WHERE id = NEW.store_id;

  -- Determine message and sender based on new status
  CASE NEW.status
    WHEN 'pendente' THEN
      _msg := '📋 Pedido recebido pela loja';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'preparando' THEN
      _msg := '👨‍🍳 Seu pedido está sendo preparado!';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'pronto_para_entrega' THEN
      _msg := '📦 Pedido pronto! Aguardando entregador.';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'saiu_entrega' THEN
      _msg := '🛵 Saiu para entrega!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'em_transito' THEN
      _msg := '🛵 Entregador a caminho!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'entregue' THEN
      _msg := '✅ Pedido entregue!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'finalizado' THEN
      _msg := '🏁 Pedido finalizado. Obrigado pela preferência!';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'cancelado' THEN
      _msg := '❌ Pedido cancelado.';
      _sender := COALESCE(_store_owner, NEW.client_id);
    ELSE
      RETURN NEW;
  END CASE;

  -- Insert the system message
  INSERT INTO public.order_messages (order_id, sender_id, message)
  VALUES (NEW.id, _sender, _msg);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'insert_order_status_chat_message error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trg_order_status_chat ON public.orders;
CREATE TRIGGER trg_order_status_chat
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_order_status_chat_message();

-- Allow drivers to read messages for their assigned orders
CREATE POLICY "Drivers can read messages for assigned orders"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND o.driver_id = auth.uid()
    )
  );

-- Allow drivers to send messages on their assigned orders
CREATE POLICY "Drivers can send messages on assigned orders"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND o.driver_id = auth.uid()
    )
  );
