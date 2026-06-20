
-- ── promo_campaigns ─────────────────────────────────────────────
CREATE TABLE public.promo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  city text NOT NULL,
  max_uses integer NOT NULL DEFAULT 10,
  uses_count integer NOT NULL DEFAULT 0,
  plan_type text NOT NULL DEFAULT 'fixed',
  monthly_fee_override numeric NOT NULL DEFAULT 0,
  commission_rate_override numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_campaigns TO anon, authenticated;
GRANT ALL ON public.promo_campaigns TO service_role;

ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_campaigns public read active"
  ON public.promo_campaigns FOR SELECT
  USING (active = true);

CREATE POLICY "promo_campaigns admin manage"
  ON public.promo_campaigns FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── promo_redemptions (1 store = 1 promo, idempotente) ──────────
CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_redemptions admin read"
  ON public.promo_redemptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── seed Londrina ───────────────────────────────────────────────
INSERT INTO public.promo_campaigns (code, city, max_uses, plan_type, monthly_fee_override, commission_rate_override)
VALUES ('LONDRINA10', 'Londrina', 10, 'fixed', 0, 0)
ON CONFLICT (code) DO NOTHING;

-- ── RPC: vagas restantes (público) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_promo_remaining(_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'code', code,
    'city', city,
    'max_uses', max_uses,
    'uses_count', uses_count,
    'remaining', GREATEST(0, max_uses - uses_count),
    'active', active AND (expires_at IS NULL OR expires_at > now())
  )
  FROM public.promo_campaigns
  WHERE code = upper(_code);
$$;

GRANT EXECUTE ON FUNCTION public.get_promo_remaining(text) TO anon, authenticated;

-- ── RPC: aplicar promo à loja recém-criada ──────────────────────
CREATE OR REPLACE FUNCTION public.apply_promo_to_store(_store_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _camp public.promo_campaigns%ROWTYPE;
  _store_owner uuid;
BEGIN
  -- valida ownership da loja (auth.uid deve ser dono)
  SELECT owner_id INTO _store_owner FROM public.stores WHERE id = _store_id;
  IF _store_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;
  IF _store_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  -- lock na campanha
  SELECT * INTO _camp FROM public.promo_campaigns
    WHERE code = upper(_code) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;
  IF NOT _camp.active OR (_camp.expires_at IS NOT NULL AND _camp.expires_at < now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;
  IF _camp.uses_count >= _camp.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'sold_out');
  END IF;

  -- idempotente
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE store_id = _store_id) THEN
    RETURN jsonb_build_object('success', true, 'already_applied', true);
  END IF;

  -- aplica ao store_plans
  UPDATE public.store_plans
     SET plan_type = _camp.plan_type::store_plan_type,
         monthly_fee = _camp.monthly_fee_override,
         commission_rate = _camp.commission_rate_override
   WHERE store_id = _store_id AND is_active = true;

  -- registra
  INSERT INTO public.promo_redemptions (store_id, campaign_id)
    VALUES (_store_id, _camp.id);

  UPDATE public.promo_campaigns
     SET uses_count = uses_count + 1
   WHERE id = _camp.id;

  RETURN jsonb_build_object('success', true, 'campaign', _camp.code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_promo_to_store(uuid, text) TO authenticated;
