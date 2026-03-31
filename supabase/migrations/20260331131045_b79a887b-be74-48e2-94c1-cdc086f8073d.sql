
-- Make delivery pin trigger also fire on UPDATE (for PIX orders going from aguardando_pagamento to pendente)
DROP TRIGGER IF EXISTS set_delivery_pin ON public.orders;
CREATE TRIGGER set_delivery_pin
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_delivery_pin();
