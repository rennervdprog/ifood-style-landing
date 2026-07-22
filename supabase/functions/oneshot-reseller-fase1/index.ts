// Fase 1 do Sistema de Revenda - cria tabelas, RLS, RPCs e role no Supabase externo
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

const SQL = `
-- ============================================================
-- Sistema de Revenda - Fase 1: Infra
-- ============================================================

-- 1) Enum de status de revendedor
DO $$ BEGIN
  CREATE TYPE public.reseller_status AS ENUM ('pending','approved','blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.reseller_referral_status AS ENUM ('pending','active','churned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.reseller_commission_type AS ENUM ('bounty','recurring','gmv_bonus');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.reseller_commission_status AS ENUM ('pending','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Novo role 'revendedor' no enum app_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype
      AND enumlabel = 'revendedor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'revendedor';
  END IF;
END $$;

-- 3) Tabela resellers
CREATE TABLE IF NOT EXISTS public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status public.reseller_status NOT NULL DEFAULT 'pending',
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  bounty_amount_cents INTEGER NOT NULL DEFAULT 15000,
  gmv_bonus_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  pix_key TEXT,
  pix_key_type TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resellers_code ON public.resellers(code);
CREATE INDEX IF NOT EXISTS idx_resellers_status ON public.resellers(status);

GRANT SELECT, INSERT, UPDATE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resellers_self_select" ON public.resellers;
CREATE POLICY "resellers_self_select" ON public.resellers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "resellers_self_insert" ON public.resellers;
CREATE POLICY "resellers_self_insert" ON public.resellers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "resellers_admin_update" ON public.resellers;
CREATE POLICY "resellers_admin_update" ON public.resellers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "resellers_self_pix_update" ON public.resellers;
CREATE POLICY "resellers_self_pix_update" ON public.resellers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = (SELECT status FROM public.resellers r WHERE r.id = resellers.id));

-- 4) reseller_referrals
CREATE TABLE IF NOT EXISTS public.reseller_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'link',
  status public.reseller_referral_status NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reseller_referrals_reseller ON public.reseller_referrals(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_referrals_store ON public.reseller_referrals(store_id);
CREATE INDEX IF NOT EXISTS idx_reseller_referrals_status ON public.reseller_referrals(status);

GRANT SELECT ON public.reseller_referrals TO authenticated;
GRANT ALL ON public.reseller_referrals TO service_role;
ALTER TABLE public.reseller_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reseller_referrals_self_select" ON public.reseller_referrals;
CREATE POLICY "reseller_referrals_self_select" ON public.reseller_referrals
  FOR SELECT TO authenticated
  USING (
    reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- 5) reseller_commissions
CREATE TABLE IF NOT EXISTS public.reseller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  type public.reseller_commission_type NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  reference_month TEXT,
  billing_ref TEXT,
  status public.reseller_commission_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  paid_batch_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_reseller ON public.reseller_commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_status ON public.reseller_commissions(status);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_ref_month ON public.reseller_commissions(reference_month);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reseller_recurring_month
  ON public.reseller_commissions(reseller_id, store_id, reference_month)
  WHERE type = 'recurring';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reseller_bounty_store
  ON public.reseller_commissions(reseller_id, store_id)
  WHERE type = 'bounty';

GRANT SELECT ON public.reseller_commissions TO authenticated;
GRANT ALL ON public.reseller_commissions TO service_role;
ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reseller_commissions_self_select" ON public.reseller_commissions;
CREATE POLICY "reseller_commissions_self_select" ON public.reseller_commissions
  FOR SELECT TO authenticated
  USING (
    reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- 6) reseller_withdrawal_requests
CREATE TABLE IF NOT EXISTS public.reseller_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 10000),
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  asaas_transfer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reseller_withdrawals_reseller ON public.reseller_withdrawal_requests(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_withdrawals_status ON public.reseller_withdrawal_requests(status);

GRANT SELECT, INSERT ON public.reseller_withdrawal_requests TO authenticated;
GRANT ALL ON public.reseller_withdrawal_requests TO service_role;
ALTER TABLE public.reseller_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reseller_wr_self_select" ON public.reseller_withdrawal_requests;
CREATE POLICY "reseller_wr_self_select" ON public.reseller_withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

DROP POLICY IF EXISTS "reseller_wr_self_insert" ON public.reseller_withdrawal_requests;
CREATE POLICY "reseller_wr_self_insert" ON public.reseller_withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid() AND status = 'approved')
  );

-- 7) Colunas em stores para vínculo com revendedor
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS referred_by_reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS reseller_locked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_stores_referred_by_reseller ON public.stores(referred_by_reseller_id) WHERE referred_by_reseller_id IS NOT NULL;

-- 8) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_resellers_updated_at ON public.resellers;
CREATE TRIGGER trg_resellers_updated_at BEFORE UPDATE ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_reseller_referrals_updated_at ON public.reseller_referrals;
CREATE TRIGGER trg_reseller_referrals_updated_at BEFORE UPDATE ON public.reseller_referrals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_reseller_wr_updated_at ON public.reseller_withdrawal_requests;
CREATE TRIGGER trg_reseller_wr_updated_at BEFORE UPDATE ON public.reseller_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
`;

const RPCS = `
-- ============================================================
-- RPCs do Sistema de Revenda
-- ============================================================

-- reseller_register: cria pending para o auth.uid() atual
CREATE OR REPLACE FUNCTION public.reseller_register(_code TEXT, _pix_key TEXT DEFAULT NULL, _pix_key_type TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, code TEXT, status public.reseller_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_code TEXT; v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_code := upper(regexp_replace(coalesce(_code,''),'[^A-Z0-9]','','g'));
  IF length(v_code) < 4 OR length(v_code) > 20 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.resellers WHERE code = v_code) THEN RAISE EXCEPTION 'code_taken'; END IF;
  INSERT INTO public.resellers(user_id, code, status, pix_key, pix_key_type)
    VALUES (v_uid, v_code, 'pending', _pix_key, _pix_key_type)
    ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, pix_key = EXCLUDED.pix_key, pix_key_type = EXCLUDED.pix_key_type, updated_at = now()
    RETURNING resellers.id INTO v_id;
  RETURN QUERY SELECT r.id, r.code, r.status FROM public.resellers r WHERE r.id = v_id;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_register(TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_register(TEXT,TEXT,TEXT) TO authenticated;

-- reseller_lookup_code: valida se um código existe (público, pra usar no cadastro)
CREATE OR REPLACE FUNCTION public.reseller_lookup_code(_code TEXT)
RETURNS TABLE (exists_flag BOOLEAN, reseller_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT; v_id UUID;
BEGIN
  v_code := upper(regexp_replace(coalesce(_code,''),'[^A-Z0-9]','','g'));
  SELECT id INTO v_id FROM public.resellers WHERE code = v_code AND status = 'approved';
  RETURN QUERY SELECT v_id IS NOT NULL, v_id;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_lookup_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_lookup_code(TEXT) TO anon, authenticated;

-- reseller_get_dashboard: painel do revendedor logado
CREATE OR REPLACE FUNCTION public.reseller_get_dashboard()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_reseller RECORD; v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_reseller FROM public.resellers WHERE user_id = v_uid;
  IF v_reseller IS NULL THEN RETURN jsonb_build_object('registered', false); END IF;

  SELECT jsonb_build_object(
    'registered', true,
    'reseller', to_jsonb(v_reseller),
    'stats', jsonb_build_object(
      'total_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id),
      'active_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id AND status='active'),
      'pending_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id AND status='pending'),
      'balance_pending_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status='pending'),0),
      'balance_paid_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status='paid'),0),
      'earnings_this_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND reference_month = to_char(now(),'YYYY-MM')),0)
    ),
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store_id', s.id,
        'name', s.name,
        'city', s.city,
        'plan_type', sp.plan_type,
        'status', s.status,
        'referral_status', rr.status,
        'activated_at', rr.activated_at,
        'gmv_60d_cents', COALESCE((SELECT sum(o.total_cents) FROM public.orders o WHERE o.store_id = s.id AND o.status='entregue' AND o.created_at >= now() - interval '60 days'),0),
        'commissions_total_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND store_id = s.id),0)
      ) ORDER BY rr.created_at DESC)
      FROM public.reseller_referrals rr
      JOIN public.stores s ON s.id = rr.store_id
      LEFT JOIN public.store_plans sp ON sp.store_id = s.id
      WHERE rr.reseller_id = v_reseller.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_get_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_get_dashboard() TO authenticated;

-- admin_reseller_approve
CREATE OR REPLACE FUNCTION public.admin_reseller_approve(_reseller_id UUID, _rate NUMERIC DEFAULT NULL, _bounty_cents INTEGER DEFAULT NULL, _gmv_bonus_rate NUMERIC DEFAULT NULL)
RETURNS public.resellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.resellers; v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.resellers SET
    status = 'approved',
    commission_rate = COALESCE(_rate, commission_rate),
    bounty_amount_cents = COALESCE(_bounty_cents, bounty_amount_cents),
    gmv_bonus_rate = COALESCE(_gmv_bonus_rate, gmv_bonus_rate),
    approved_at = now(),
    approved_by = v_uid,
    updated_at = now()
  WHERE id = _reseller_id
  RETURNING * INTO v_row;

  -- concede role de revendedor
  INSERT INTO public.user_roles(user_id, role) VALUES (v_row.user_id, 'revendedor') ON CONFLICT DO NOTHING;

  INSERT INTO public.admin_logs(admin_id, action, target_type, target_id, details)
    VALUES (v_uid, 'reseller_approve', 'reseller', v_row.id, jsonb_build_object('code', v_row.code));
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.admin_reseller_approve(UUID,NUMERIC,INTEGER,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_approve(UUID,NUMERIC,INTEGER,NUMERIC) TO authenticated;

-- admin_reseller_block
CREATE OR REPLACE FUNCTION public.admin_reseller_block(_reseller_id UUID, _reason TEXT)
RETURNS public.resellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.resellers; v_uid UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.resellers SET status = 'blocked', notes = coalesce(notes,'') || E'\n[BLOCK ' || to_char(now(),'YYYY-MM-DD') || '] ' || coalesce(_reason,''), updated_at = now()
  WHERE id = _reseller_id RETURNING * INTO v_row;
  INSERT INTO public.admin_logs(admin_id, action, target_type, target_id, details)
    VALUES (v_uid, 'reseller_block', 'reseller', v_row.id, jsonb_build_object('reason', _reason));
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.admin_reseller_block(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_block(UUID,TEXT) TO authenticated;

-- admin_reseller_stats: ranking
CREATE OR REPLACE FUNCTION public.admin_reseller_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_result JSONB;
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'resellers_total', (SELECT count(*) FROM public.resellers),
      'resellers_approved', (SELECT count(*) FROM public.resellers WHERE status='approved'),
      'resellers_pending', (SELECT count(*) FROM public.resellers WHERE status='pending'),
      'referrals_active', (SELECT count(*) FROM public.reseller_referrals WHERE status='active'),
      'commissions_pending_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE status='pending'),0),
      'commissions_paid_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE status='paid'),0)
    ),
    'ranking', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'reseller_id', r.id,
        'code', r.code,
        'status', r.status,
        'active_stores', (SELECT count(*) FROM public.reseller_referrals rr WHERE rr.reseller_id = r.id AND rr.status='active'),
        'total_stores', (SELECT count(*) FROM public.reseller_referrals rr WHERE rr.reseller_id = r.id),
        'earned_total_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = r.id),0),
        'earned_this_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = r.id AND reference_month = to_char(now(),'YYYY-MM')),0)
      ) ORDER BY r.created_at DESC)
      FROM public.resellers r
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.admin_reseller_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_stats() TO authenticated;

-- reseller_attach_signup: chamado no cadastro para vincular loja recém criada ao revendedor
CREATE OR REPLACE FUNCTION public.reseller_attach_signup(_store_id UUID, _code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT; v_reseller UUID; v_store_owner UUID;
BEGIN
  v_code := upper(regexp_replace(coalesce(_code,''),'[^A-Z0-9]','','g'));
  IF v_code = '' THEN RETURN false; END IF;
  SELECT id INTO v_reseller FROM public.resellers WHERE code = v_code AND status = 'approved';
  IF v_reseller IS NULL THEN RETURN false; END IF;
  SELECT owner_id INTO v_store_owner FROM public.stores WHERE id = _store_id;
  -- proteção auto-indicação
  IF v_store_owner IS NOT NULL AND EXISTS (SELECT 1 FROM public.resellers WHERE id = v_reseller AND user_id = v_store_owner) THEN RETURN false; END IF;

  UPDATE public.stores SET
    referred_by_reseller_id = v_reseller,
    reseller_locked_at = now()
  WHERE id = _store_id AND referred_by_reseller_id IS NULL;

  INSERT INTO public.reseller_referrals(reseller_id, store_id, source, status)
    VALUES (v_reseller, _store_id, 'link', 'pending')
    ON CONFLICT (store_id) DO NOTHING;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_attach_signup(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_attach_signup(UUID,TEXT) TO anon, authenticated;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.step1_tables = await q(SQL);
  // enum ADD VALUE precisa commit antes de RPCs referenciarem - executar em call separada
  out.step2_rpcs = await q(RPCS);
  out.verify_tables = await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('resellers','reseller_referrals','reseller_commissions','reseller_withdrawal_requests')
    ORDER BY table_name;
  `);
  out.verify_rpcs = await q(`
    SELECT proname FROM pg_proc WHERE proname LIKE 'reseller_%' OR proname LIKE 'admin_reseller_%' ORDER BY proname;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});