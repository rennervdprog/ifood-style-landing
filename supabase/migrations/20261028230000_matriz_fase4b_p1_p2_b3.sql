-- Fase 4b — Decisões do Renner de 28/10/2026 (~20:08): P1, P2 e B3.
--
-- NÃO altera a migration 20261028220000 (regra do PR: RPC nova vai em
-- migration nova, com CREATE OR REPLACE). NENHUM dado existente é
-- reescrito; só estrutura + redefinição da função de cálculo.
--
-- P1 — rede só-PDV tem base 0 (REGRA, não override): em
-- calculate_network_monthly_fee, se a rede tem ZERO sublojas de delivery
-- publicadas e PELO MENOS UMA subloja só-PDV publicada, a base é 0 e o
-- breakdown ganha base_reason = 'pdv_only_network'. Cada unidade só-PDV
-- continua pagando o próprio plano (R$ 120) pela cobrança por loja — a
-- rede não cobra base em cima. Rede mista inalterada (base cheia +
-- R$ 39,90 só sobre delivery além de 3). A regra P1 vence até um
-- override (P2): cobrar base de rede em cima de unidades que já pagam
-- o próprio plano seria dupla cobrança; o override fica registrado no
-- breakdown, mas não gera base nesse caso.
--
-- P2 — monthly_fee_override nullable em store_networks: precedência da
-- base override (não-nulo) > template > valor guardado. O selo VIP da
-- rede (is_vip no breakdown) segue a MESMA regra de divergência de valor
-- do front (src/lib/vipDetection.ts): override presente E diferente do
-- preço de referência (template, ou guardado sem template) — override
-- igual ao default NÃO é VIP (limpa os falso-VIPs dos relatórios).
-- Exemplo do teste: rede fixed com guardado 90 + override 90 → base 90
-- (não 89,90 do template); sem override → template 89,90.
--
-- B3 — recria admin_logs (arquivo apenas; NADA aplicado no vivo por
-- este PR): reproduz a migration original de 29/04/2026
-- (20260429013354), que criava a tabela, com CREATE TABLE IF NOT EXISTS
-- + policy guardada, para o ambiente voltar a ter a tabela que logVip()
-- e VipHistoryPanel (AdminPlanManager.tsx) esperam: autor
-- (admin_user_id), timestamp (created_at), before/after via details
-- jsonb, action, target_type, target_id. Recria também a função
-- log_admin_action do arquivo original (CREATE OR REPLACE, inofensiva
-- se já existir).
--
-- B2 NÃO está aqui: vitalício = só "sem upgrade automático", sem
-- isentar cobrança — por isso NÃO há mudança nenhuma de billing nesta
-- migration; só rótulo no editor + comentário no código (AdminPlanManager).
-- B4 NÃO está aqui: é correção da edge monthly-billing (select fantasma),
-- sem mudança de schema.
--
-- NÃO TOCA em repasse, em essencial_lifetime_free, nem no R$ 9/mês do
-- Pastelão Carioca (teste VIP intencional do Renner — continua cobrado).

-- ---------------------------------------------------------------------------
-- P2. monthly_fee_override nullable em store_networks (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'monthly_fee_override') THEN
    ALTER TABLE public.store_networks ADD COLUMN monthly_fee_override numeric;
  END IF;
END $$;

COMMENT ON COLUMN public.store_networks.monthly_fee_override IS
  'Fase 4b (P2): preço VIP negociado da rede. Precedência da base: override (não-nulo) > plan_templates.monthly_fee > monthly_fee guardado. Override igual ao template NÃO é VIP (regra de divergência de valor). NULL = sem negociação.';

-- ---------------------------------------------------------------------------
-- B3. Recriar admin_logs (tabela original de 29/04/2026, IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'admin_logs'
                 AND policyname = 'Admins can view all logs') THEN
    CREATE POLICY "Admins can view all logs"
    ON public.admin_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
    _action TEXT,
    _target_type TEXT,
    _target_id UUID,
    _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem registrar logs.';
    END IF;

    INSERT INTO public.admin_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), _action, _target_type, _target_id, _details)
    RETURNING id INTO _log_id;

    RETURN _log_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- P1 + P2. calculate_network_monthly_fee — redefinição (CREATE OR REPLACE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_network_monthly_fee(_network_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  _network record;
  _template_fee numeric;
  _base numeric;
  _base_reason text;
  _is_vip boolean := false;
  _delivery_count int := 0;
  _pdv_only_count int := 0;
  _gmv numeric := 0;
  _extra_count int := 0;
  _extra_fee numeric := 0;
  _free boolean := false;
  _total numeric := 0;
BEGIN
  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  -- Template ativo do plano (pode ser NULL — sem template, usa o guardado).
  SELECT pt.monthly_fee INTO _template_fee
    FROM public.plan_templates pt
   WHERE pt.plan_type = _network.plan_type AND COALESCE(pt.is_active, true) = true
   ORDER BY pt.sort_order NULLS LAST
   LIMIT 1;

  -- Contagens (idênticas à 20261028220000: publicada = status 'ativo',
  -- não-matriz; só-PDV fora da conta de delivery — Decisão 6).
  SELECT COUNT(*) INTO _delivery_count
    FROM public.stores s
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND s.status = 'ativo'
     AND NOT (
       COALESCE(s.plan_type::text, '') = 'pdv_only'
       OR EXISTS (SELECT 1 FROM public.store_plans sp
                   WHERE sp.store_id = s.id AND sp.is_active = true
                     AND sp.plan_type = 'pdv_only')
     );
  SELECT COUNT(*) INTO _pdv_only_count
    FROM public.stores s
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND s.status = 'ativo'
     AND (
       COALESCE(s.plan_type::text, '') = 'pdv_only'
       OR EXISTS (SELECT 1 FROM public.store_plans sp
                   WHERE sp.store_id = s.id AND sp.is_active = true
                     AND sp.plan_type = 'pdv_only')
     );

  -- P1 (REGRA): rede só de só-PDV (0 delivery, >= 1 só-PDV) → base 0.
  -- Vence o override: as unidades já pagam o próprio plano por loja.
  IF _delivery_count = 0 AND _pdv_only_count > 0 THEN
    _base := 0;
    _base_reason := 'pdv_only_network';
    _is_vip := false;
  -- P2: override (não-nulo) > template > guardado.
  ELSIF _network.monthly_fee_override IS NOT NULL THEN
    _base := _network.monthly_fee_override;
    _base_reason := 'override';
    -- Selo VIP por divergência de valor (override == referência NÃO é VIP).
    _is_vip := _network.monthly_fee_override IS DISTINCT FROM
      COALESCE(_template_fee, _network.monthly_fee);
  ELSIF _template_fee IS NOT NULL THEN
    _base := _template_fee;
    _base_reason := 'template';
  ELSE
    _base := COALESCE(_network.monthly_fee, 0);
    _base_reason := 'stored_fallback';
  END IF;

  -- GMV 60 dias de TODAS as sublojas (PDV conta — Decisão 11).
  SELECT COALESCE(SUM(o.total_price), 0) INTO _gmv
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND o.status IN ('entregue', 'finalizado')
     AND o.created_at >= now() - interval '60 days';

  _free := _gmv <= 5000;
  _extra_count := GREATEST(0, _delivery_count - 3);
  _extra_fee := _extra_count * 39.90;
  _total := CASE WHEN _free THEN 0 ELSE _base + _extra_fee END;

  RETURN jsonb_build_object(
    'network_id', _network_id,
    'plan_type', _network.plan_type,
    'base_monthly_fee', _base,
    'base_reason', _base_reason,
    'monthly_fee_override', _network.monthly_fee_override,
    'template_monthly_fee', _template_fee,
    'stored_monthly_fee', _network.monthly_fee,
    'is_vip', _is_vip,
    'vip_kind', CASE WHEN _base_reason = 'pdv_only_network' THEN 'systemic'
                    WHEN _is_vip THEN 'granted' ELSE 'none' END,
    'delivery_unit_count', _delivery_count,
    'pdv_only_unit_count', _pdv_only_count,
    'free_units_included', 3,
    'extra_unit_count', _extra_count,
    'extra_unit_fee', 39.90,
    'extra_fee', _extra_fee,
    'gmv_60d', _gmv,
    'free_gmv_threshold', 5000,
    'free_by_gmv', _free,
    'total_monthly_fee', _total
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_network_monthly_fee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_network_monthly_fee(uuid) TO service_role;
