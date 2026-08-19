-- Expõe o tipo de plano no catálogo público sem alterar quais lojas a função base retorna.
-- Clientes podem ocultar lojas `pdv_only`, que não possuem vitrine pública nem delivery.
-- A view continua usando security_invoker para respeitar as permissões do solicitante.

BEGIN;

CREATE OR REPLACE VIEW public.stores_public
WITH (security_invoker = true)
AS
SELECT
  catalog.id,
  catalog.name,
  catalog.slug,
  catalog.slug_aliases,
  catalog.image_url,
  catalog.category,
  catalog.categories,
  catalog.rating,
  catalog.is_open,
  catalog.force_closed,
  catalog.status,
  catalog.delivery_mode,
  catalog.delivery_enabled,
  catalog.own_delivery_fee,
  catalog.delivery_fee,
  catalog.delivery_radius,
  catalog.delivery_fee_type,
  catalog.delivery_base_km,
  catalog.delivery_fee_base,
  catalog.delivery_fee_per_km,
  catalog.minimum_order_value,
  catalog.free_delivery_threshold,
  catalog.estimated_delivery_time,
  catalog.max_delivery_km,
  catalog.owner_id,
  catalog.address_cep,
  catalog.address_city,
  catalog.address_complement,
  catalog.address_neighborhood,
  catalog.address_number,
  catalog.address_reference,
  catalog.address_state,
  catalog.address_street,
  catalog.latitude,
  catalog.longitude,
  catalog.settings,
  catalog.platform_fee_split,
  catalog.preorder_enabled,
  catalog.preorder_minutes_before,
  catalog.pix_direto_enabled,
  catalog.pix_direto_key,
  catalog.pix_direto_key_type,
  catalog.pix_direto_beneficiary,
  catalog.pix_direto_instructions,
  catalog.guest_checkout_enabled,
  catalog.network_id,
  catalog.is_matriz,
  catalog.is_visible,
  catalog.created_at,
  stores.plan_type
FROM public.get_public_stores() AS catalog
JOIN public.stores AS stores ON stores.id = catalog.id;

GRANT SELECT ON public.stores_public TO anon, authenticated;

COMMENT ON VIEW public.stores_public IS
  'Catálogo público de lojas. plan_type permite ao cliente ocultar lojas exclusivamente PDV.';

COMMIT;
