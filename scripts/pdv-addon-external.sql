-- ============================================================================
-- Migration: PDV como módulo pago (add-on)
-- Rodar no Supabase EXTERNO qkjhguziuchqsbxzruea
-- ============================================================================

-- 1) Feature flag global (nada aparece pro lojista enquanto false)
INSERT INTO admin_settings (key, value)
VALUES ('addons_module_enabled', to_jsonb(false))
ON CONFLICT (key) DO NOTHING;

-- 2) Catálogo global de add-ons
CREATE TABLE IF NOT EXISTS plan_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  monthly_price numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON plan_addons TO anon, authenticated;
GRANT ALL ON plan_addons TO service_role;
ALTER TABLE plan_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_addons read" ON plan_addons;
CREATE POLICY "plan_addons read" ON plan_addons FOR SELECT USING (true);

INSERT INTO plan_addons (code, name, monthly_price)
VALUES ('pdv', 'PDV — Ponto de Venda', 49.00)
ON CONFLICT (code) DO NOTHING;

-- 3) Contratações por loja
CREATE TABLE IF NOT EXISTS store_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  addon_code text NOT NULL REFERENCES plan_addons(code),
  enabled boolean NOT NULL DEFAULT true,
  price_override numeric(10,2), -- NULL = usa preço do catálogo. 0 = VIP grátis.
  activated_at timestamptz NOT NULL DEFAULT now(),
  cancels_at timestamptz,       -- se preenchido, cancela ao chegar essa data
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, addon_code)
);
CREATE INDEX IF NOT EXISTS store_addons_store_idx ON store_addons(store_id);
GRANT SELECT ON store_addons TO authenticated;
GRANT ALL ON store_addons TO service_role;
ALTER TABLE store_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_addons owner read" ON store_addons;
CREATE POLICY "store_addons owner read" ON store_addons
FOR SELECT USING (
  EXISTS (SELECT 1 FROM stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
);

-- 4) Grandfathering: coluna legacy_pdv
ALTER TABLE stores ADD COLUMN IF NOT EXISTS legacy_pdv boolean NOT NULL DEFAULT false;

-- Marcar TODAS as lojas atuais como legacy (mantêm PDV com regra R$1/pedido)
UPDATE stores SET legacy_pdv = true WHERE created_at < now();

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS store_addons_touch ON store_addons;
CREATE TRIGGER store_addons_touch BEFORE UPDATE ON store_addons
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS plan_addons_touch ON plan_addons;
CREATE TRIGGER plan_addons_touch BEFORE UPDATE ON plan_addons
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();