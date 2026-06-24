-- Garante o valor do enum
ALTER TYPE public.store_plan_type ADD VALUE IF NOT EXISTS 'autonomy';

-- Template do novo plano (features é jsonb)
INSERT INTO public.plan_templates (plan_key, plan_type, label, description, monthly_fee, commission_rate, features, sort_order, is_active)
SELECT 'autonomy', 'fixed', 'Autonomia',
  'Mensalidade fixa sem comissão e SEM taxa de R$2 da plataforma na entrega. Apenas PIX online tem taxa de R$1,99.',
  229.90, 0,
  to_jsonb(ARRAY[
    'Sem comissão por pedido',
    'Sem taxa de R$2 da plataforma na entrega',
    'Você fica com 100% da taxa de entrega',
    'Apenas PIX online: R$1,99/pedido',
    'Todas as ferramentas (PIX, Fidelidade, Banners, Relatórios)',
    '7 dias grátis para testar'
  ]),
  0, true
WHERE NOT EXISTS (SELECT 1 FROM public.plan_templates WHERE plan_key = 'autonomy');

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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login antes de cadastrar a loja.'
      USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    IF NOT EXISTS (SELECT 1 FROM stores WHERE owner_id = _user_id) THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
    END IF;
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

  IF _selected_plan IN ('supporter', 'apoiador') THEN
    _plan_type := 'supporter'::store_plan_type;
    _monthly_fee := 130.00;
    _commission_rate := 0.00;
  ELSIF _selected_plan = 'fixed' THEN
    _plan_type := 'fixed'::store_plan_type;
    _monthly_fee := 180.00;
    _commission_rate := 0.00;
  ELSIF _selected_plan = 'hybrid' THEN
    _plan_type := 'hybrid'::store_plan_type;
    _monthly_fee := 100.00;
    _commission_rate := 2.5;
  ELSIF _selected_plan = 'autonomy' THEN
    _plan_type := 'autonomy'::store_plan_type;
    _monthly_fee := 229.90;
    _commission_rate := 0.00;
    _split_override := 0.00;
  ELSE
    _plan_type := 'commission_only'::store_plan_type;
    _monthly_fee := 0.00;
    _commission_rate := 6.0;
  END IF;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at, platform_delivery_split_override)
  VALUES (
    _store_id,
    _plan_type,
    _monthly_fee,
    _commission_rate,
    true,
    CASE WHEN _plan_type IN ('fixed', 'hybrid', 'supporter', 'autonomy') THEN now() + interval '7 days' ELSE NULL END,
    _split_override
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$function$;