-- ⚠️ Executar no BANCO EXTERNO (qkjhguziuchqsbxzruea). Ajusta apenas a função register_as_lojista.
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category store_category,
  _avatar_url text DEFAULT NULL::text,
  _whatsapp text DEFAULT NULL::text,
  _selected_plan text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
  _split_override numeric := NULL;
  _pdv_rate numeric := 0;
  _pix_fee numeric := 1.99;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login antes de cadastrar a loja.'
      USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM stores WHERE owner_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id, delivery_mode)
  VALUES (_store_name, _store_category, _user_id, 'own')
  RETURNING id INTO _store_id;

  IF _selected_plan = 'fixed' THEN
    _plan_type := 'fixed'::store_plan_type;
    _monthly_fee := 90.00;          -- inicial (upgrade R$180 controlado por revenue_threshold)
    _commission_rate := 0.00;
    _pdv_rate := 0;                 -- PDV R$1 fixo é cobrado pelo trigger accrue_pdv_fixed_fee
  ELSIF _selected_plan = 'autonomy' THEN
    _plan_type := 'autonomy'::store_plan_type;
    _monthly_fee := 229.90;
    _commission_rate := 0.00;
    _split_override := 0.00;        -- SEM taxa R$2 da plataforma na entrega
    _pdv_rate := 0;
  ELSIF _selected_plan IN ('supporter', 'apoiador') THEN
    _plan_type := 'supporter'::store_plan_type;
    _monthly_fee := 75.00;
    _commission_rate := 0.00;
    _pdv_rate := 0;
  ELSIF _selected_plan = 'hybrid' THEN
    _plan_type := 'hybrid'::store_plan_type;
    _monthly_fee := 50.00;
    _commission_rate := 2.5;
    _pdv_rate := 2;
  ELSE
    -- commission_only (padrão)
    _plan_type := 'commission_only'::store_plan_type;
    _monthly_fee := 0.00;
    _commission_rate := 6.0;
    _pdv_rate := 2;                 -- PDV cobra 2% no plano Comissão
  END IF;

  INSERT INTO public.store_plans (
    store_id, plan_type, monthly_fee, commission_rate, is_active,
    trial_ends_at, platform_delivery_split_override,
    pdv_enabled, pdv_commission_rate, pix_operational_fee_override
  )
  VALUES (
    _store_id,
    _plan_type,
    _monthly_fee,
    _commission_rate,
    true,
    CASE WHEN _plan_type IN ('fixed', 'hybrid', 'supporter', 'autonomy') THEN now() + interval '7 days' ELSE NULL END,
    _split_override,
    true,
    _pdv_rate,
    _pix_fee
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$function$;