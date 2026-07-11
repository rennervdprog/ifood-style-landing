const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const out: Record<string, unknown> = {};
  out.store = await q(`SELECT id, name, slug, is_open FROM public.stores WHERE name ILIKE '%cantinho%silvia%' OR slug ILIKE '%cantinho%silvia%';`);
  out.today_orders = await q(`
    SELECT id, order_number, status, payment_method, price, delivery_fee, created_at, source
    FROM public.orders
    WHERE store_id = (SELECT id FROM public.stores WHERE name ILIKE '%cantinho%silvia%' LIMIT 1)
      AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo'
    ORDER BY created_at DESC;
  `);
  out.today_summary = await q(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE source='pdv') AS pdv,
      COUNT(*) FILTER (WHERE source IS NULL OR source<>'pdv') AS delivery,
      COUNT(*) FILTER (WHERE status='finalizado') AS finalizado,
      COUNT(*) FILTER (WHERE status NOT IN ('finalizado','cancelado')) AS abertos,
      COALESCE(SUM(price),0) AS faturamento,
      COALESCE(SUM(delivery_fee),0) AS taxas_entrega
    FROM public.orders
    WHERE store_id = (SELECT id FROM public.stores WHERE name ILIKE '%cantinho%silvia%' LIMIT 1)
      AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo';
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
