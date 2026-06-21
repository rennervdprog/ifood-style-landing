-- Per-store config: como a taxa de R$2 da plataforma (na entrega PRÓPRIA) é dividida
-- 'cliente'      → cliente paga R$2 a mais (default, comportamento atual)
-- 'meio_a_meio'  → cliente paga R$1, loja absorve R$1 (acumula em repasse_pendente)
-- 'lojista'      → cliente não vê R$2, loja absorve R$2 (acumula em repasse_pendente)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS platform_fee_split text NOT NULL DEFAULT 'cliente'
    CHECK (platform_fee_split IN ('cliente','meio_a_meio','lojista'));

COMMENT ON COLUMN public.stores.platform_fee_split IS
  'Divisão da taxa de R$2 da plataforma na entrega própria: cliente | meio_a_meio | lojista. Define quanto o lojista absorve (0, 1.00 ou 2.00) e é acumulado em store_balances.repasse_pendente a cada pedido finalizado.';

-- Helper: quanto a LOJA absorve por pedido (entrega própria)
-- Aplica a TODOS os planos. Preserva override VIP (platform_delivery_split_override) quando definido.
CREATE OR REPLACE FUNCTION public.get_store_platform_fee_charge(_store_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delivery_mode text;
  _split text;
  _override numeric;
  _base numeric;
BEGIN
  SELECT COALESCE(s.delivery_mode,'platform'), COALESCE(s.platform_fee_split,'cliente')
    INTO _delivery_mode, _split
  FROM public.stores s WHERE s.id = _store_id;

  IF _delivery_mode IS DISTINCT FROM 'own' THEN
    RETURN 0;
  END IF;

  -- VIP override (qualquer plano): respeita o valor exato
  SELECT sp.platform_delivery_split_override INTO _override
  FROM public.store_plans sp
  WHERE sp.store_id = _store_id AND sp.is_active = true
  LIMIT 1;

  IF _override IS NOT NULL THEN
    _base := _override;
  ELSE
    -- Lê base da config global (admin_settings.delivery_fee_config.platform_split)
    SELECT COALESCE(((value->>'platform_split')::numeric), 2)
      INTO _base
    FROM public.admin_settings WHERE key = 'delivery_fee_config' LIMIT 1;
    _base := COALESCE(_base, 2);
  END IF;

  RETURN CASE _split
    WHEN 'cliente' THEN 0
    WHEN 'meio_a_meio' THEN ROUND(_base / 2.0, 2)
    WHEN 'lojista' THEN _base
    ELSE 0
  END;
END;
$$;

-- Atualiza get_fixed_plan_platform_split para delegar à nova função
-- (mantém assinatura para não quebrar chamadas existentes nas accrual functions)
CREATE OR REPLACE FUNCTION public.get_fixed_plan_platform_split(_store_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_store_platform_fee_charge(_store_id);
$$;