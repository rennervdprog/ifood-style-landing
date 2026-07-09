const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SQL = `
-- 1) stores.plan_type
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'essencial';

-- 2) stores.is_visible
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- 3) addon_catalog
CREATE TABLE IF NOT EXISTS public.addon_catalog (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.addon_catalog TO anon, authenticated;
GRANT ALL ON public.addon_catalog TO service_role;

ALTER TABLE public.addon_catalog ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog' AND policyname='addon_catalog_read_all') THEN
    CREATE POLICY addon_catalog_read_all ON public.addon_catalog FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO public.addon_catalog (code, name, description, monthly_price, is_active) VALUES
  ('pdv', 'PDV (Ponto de Venda)', 'Módulo de PDV com caixa, movimentações e vendas presenciais.', 49.00, true),
  ('whatsapp_auto', 'WhatsApp Automático', 'Respostas automáticas e mensagens de status via WhatsApp.', 0.00, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 4) Recarrega o schema do PostgREST
NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return json({ status: resp.status, body: await resp.text() });
});
