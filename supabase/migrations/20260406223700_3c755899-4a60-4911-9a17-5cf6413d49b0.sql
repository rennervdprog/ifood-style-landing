-- Add city column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text DEFAULT 'itatinga';

-- Add city column to drivers  
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS city text DEFAULT 'itatinga';

-- Update handle_new_user to propagate city
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.partner_role;
  _full_name text;
  _document text;
  _vehicle text;
  _whatsapp text;
  _phone text;
  _store_name text;
  _store_category text;
  _city text;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.partner_role, 'cliente');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _document := NEW.raw_user_meta_data->>'document';
  _vehicle := NEW.raw_user_meta_data->>'vehicle';
  _whatsapp := NEW.raw_user_meta_data->>'whatsapp';
  _phone := NEW.raw_user_meta_data->>'phone';
  _store_name := NEW.raw_user_meta_data->>'store_name';
  _store_category := NEW.raw_user_meta_data->>'store_category';
  _city := COALESCE(NEW.raw_user_meta_data->>'city', 'itatinga');

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    document = COALESCE(EXCLUDED.document, profiles.document),
    vehicle = COALESCE(EXCLUDED.vehicle, profiles.vehicle),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    city = COALESCE(EXCLUDED.city, profiles.city);

  IF _role = 'motoboy' THEN
    INSERT INTO public.drivers (user_id, name, is_active, city)
    VALUES (NEW.id, _full_name, false, _city)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status, address_city)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'analise', _city);
  END IF;

  RETURN NEW;
END;
$function$;

-- Update driver_accept_order to restrict by city
CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _driver_city text;
  _store_city text;
BEGIN
  SELECT city INTO _driver_city FROM public.drivers WHERE user_id = auth.uid();
  
  SELECT COALESCE(s.address_city, 'itatinga') INTO _store_city
  FROM public.orders o
  JOIN public.stores s ON o.store_id = s.id
  WHERE o.id = _order_id;

  IF _driver_city IS DISTINCT FROM _store_city THEN
    RAISE EXCEPTION 'Este pedido é de outra cidade. Você só pode aceitar pedidos da sua cidade.';
  END IF;

  UPDATE public.orders
  SET driver_id = auth.uid()
  WHERE id = _order_id
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL
    AND public.is_driver(auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$function$;

-- Update drivers RLS to let drivers only see ready orders from their city
DROP POLICY IF EXISTS "Drivers can see ready orders" ON public.orders;
CREATE POLICY "Drivers can see ready orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    is_driver(auth.uid()) AND (
      (status = 'pronto_para_entrega' AND driver_id IS NULL AND store_id IN (
        SELECT s.id FROM stores s
        WHERE COALESCE(s.address_city, 'itatinga') = (
          SELECT COALESCE(d.city, 'itatinga') FROM drivers d WHERE d.user_id = auth.uid()
        )
      ))
      OR driver_id = auth.uid()
    )
  );