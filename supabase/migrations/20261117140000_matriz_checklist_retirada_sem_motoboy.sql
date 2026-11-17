-- Excecao do checklist de publicacao (decisao do Renner, 17/11/2026):
-- unidade SO-RETIRADA pode publicar SEM motoboy. O E2E de matriz do mesmo
-- dia deixou a unidade B travada em rascunho 3/4 porque o checklist exigia
-- entregador aceito incondicionalmente, mesmo para unidade sem entrega.
--
-- Definicao de "so-retirada": stores.delivery_enabled = false — o marcador
-- de "faz entrega" do sistema (mesma definicao de src/lib/storeVisibility.ts:
-- loja so-retirada passa sem exigir motoboy). Unidade com entrega
-- (delivery_enabled = true) e sem entregador aceito CONTINUA bloqueada.
--
-- So network_unit_checklist muda (definicao ao vivo copiada verbatim; so a
-- regra do entregador mudou + dois campos novos no JSON para a tela saber
-- se o item foi dispensado). publish_network_unit NAO muda: ela le o campo
-- 'driver' do checklist, entao herda a excecao automaticamente.
-- NAO TOCA em billing, policies, outras RPCs ou edges.

CREATE OR REPLACE FUNCTION public.network_unit_checklist(_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store record;
  _address_ok boolean;
  _hours_ok boolean;
  _menu_ok boolean;
  _driver_ok boolean;
  _delivery_enabled boolean;
BEGIN
  SELECT * INTO _store FROM public.stores WHERE id = _store_id;
  IF _store IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  -- Endereço completo (mesma regra da criação: rua, número, bairro,
  -- cidade e CEP).
  _address_ok := nullif(trim(coalesce(_store.address_street, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_number, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_neighborhood, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_city, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_cep, '')), '') IS NOT NULL;

  -- Horário: ao menos um dia com abertura configurada.
  _hours_ok := EXISTS (
    SELECT 1 FROM public.opening_hours
    WHERE store_id = _store_id AND NOT COALESCE(is_closed_all_day, false)
  );

  -- Cardápio: ao menos um produto disponível.
  _menu_ok := EXISTS (
    SELECT 1 FROM public.products
    WHERE store_id = _store_id AND COALESCE(is_available, false)
  );

  -- Entrega ligada? delivery_enabled e o marcador de "faz entrega" do
  -- sistema (false = so-retirada). NULL historico conta como desligada.
  _delivery_enabled := COALESCE(_store.delivery_enabled, false);

  -- Entregador: exigido SO quando a unidade faz entrega. Unidade
  -- so-retirada publica sem motoboy (decisao do Renner, 17/11/2026).
  _driver_ok := (NOT _delivery_enabled) OR EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE store_id = _store_id AND status = 'accepted'
  );

  RETURN jsonb_build_object(
    'store_id', _store_id,
    'is_draft', COALESCE(_store.is_draft, false),
    'address', _address_ok,
    'hours', _hours_ok,
    'menu', _menu_ok,
    'driver', _driver_ok,
    'delivery_enabled', _delivery_enabled,
    'driver_required', _delivery_enabled,
    'ready', (_address_ok AND _hours_ok AND _menu_ok AND _driver_ok)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.network_unit_checklist(uuid) TO authenticated, service_role;
