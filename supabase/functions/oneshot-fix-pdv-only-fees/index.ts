const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}

// 1) Zera taxa por venda e comissão pendente para planos pdv_only
// 2) Recria trigger para NUNCA acumular quando plan_type='pdv_only'
const SQL = `
UPDATE public.store_plans
SET pdv_fixed_fee_per_sale = 0,
    pdv_commission_rate = 0,
    pdv_commission_pending = 0
WHERE plan_type = 'pdv_only';

-- Zera app_fee de pedidos PDV já lançados para lojas pdv_only
UPDATE public.orders o
SET app_fee = 0
WHERE o.order_source = 'pdv'
  AND COALESCE(o.app_fee,0) > 0
  AND EXISTS (
    SELECT 1 FROM public.store_plans sp
    WHERE sp.store_id = o.store_id AND sp.is_active = true AND sp.plan_type = 'pdv_only'
  );

CREATE OR REPLACE FUNCTION public.accrue_pdv_fixed_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC(10,2);
  v_plan_type text;
BEGIN
  IF NEW.order_source = 'pdv' THEN
    SELECT COALESCE(pdv_fixed_fee_per_sale, 0), plan_type::text
      INTO v_fee, v_plan_type
    FROM public.store_plans
    WHERE store_id = NEW.store_id AND is_active = true
    LIMIT 1;

    -- pdv_only NUNCA acumula taxa por venda (PDV já embutido na mensalidade)
    IF v_plan_type = 'pdv_only' THEN
      RETURN NEW;
    END IF;

    IF v_fee > 0 THEN
      UPDATE public.store_plans
      SET pdv_commission_pending = COALESCE(pdv_commission_pending, 0) + v_fee
      WHERE store_id = NEW.store_id AND is_active = true;

      NEW.app_fee = COALESCE(NEW.app_fee, 0) + v_fee;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const r = await run(SQL);
  return new Response(JSON.stringify(r, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});