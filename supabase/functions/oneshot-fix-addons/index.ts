const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SQL = `
-- 1) Consolidar catálogo em plan_addons (canônico, alvo da FK). Descartar addon_catalog duplicado.
INSERT INTO public.plan_addons (code, name, monthly_price, is_active)
VALUES ('whatsapp_auto', 'WhatsApp Automático', 0.00, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, monthly_price = EXCLUDED.monthly_price, is_active = EXCLUDED.is_active, updated_at = now();

DROP TABLE IF EXISTS public.addon_catalog;

-- 2) Restringir grants de plan_addons (leitura pública, escrita só service_role)
REVOKE ALL ON public.plan_addons FROM anon, authenticated;
GRANT SELECT ON public.plan_addons TO anon, authenticated;
GRANT ALL ON public.plan_addons TO service_role;

-- 3) Restringir grants de store_addons (writes só via service_role/admin RPC)
REVOKE ALL ON public.store_addons FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.store_addons FROM authenticated;
GRANT SELECT ON public.store_addons TO authenticated;
GRANT ALL ON public.store_addons TO service_role;

-- 4) Políticas de escrita em store_addons para admins da plataforma
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_addons' AND policyname='store_addons admin insert') THEN
    CREATE POLICY "store_addons admin insert" ON public.store_addons FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_addons' AND policyname='store_addons admin update') THEN
    CREATE POLICY "store_addons admin update" ON public.store_addons FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'::app_role))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_addons' AND policyname='store_addons admin delete') THEN
    CREATE POLICY "store_addons admin delete" ON public.store_addons FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='admin'::app_role));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
