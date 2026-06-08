-- Bloqueia leitura pública das colunas sensíveis da tabela stores
-- (chave de API da subconta Asaas, status de ativação, PIX, etc.)
-- Mantém leitura pública das colunas não-sensíveis para a vitrine.

REVOKE ALL ON public.stores FROM anon;

GRANT SELECT (
  id, name, category, image_url, is_open, rating, created_at, owner_id, status,
  force_closed, slug, address_street, address_number, address_complement,
  address_neighborhood, address_reference, address_city, address_state, address_cep,
  delivery_mode, own_delivery_fee, settings, commission_rate, app_enabled,
  app_subscribed, latitude, longitude, is_test, categories, delivery_fee_type,
  delivery_base_km, delivery_fee_base, delivery_fee_per_km, delivery_enabled,
  delivery_fee, delivery_radius, minimum_order_value, estimated_delivery_time
) ON public.stores TO anon;

-- authenticated e service_role continuam com acesso completo (sujeito ao RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;