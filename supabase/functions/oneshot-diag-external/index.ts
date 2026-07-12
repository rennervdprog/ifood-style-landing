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
  const sid = `(SELECT id FROM public.stores WHERE name ILIKE '%cantinho%silvia%' LIMIT 1)`;
  const today = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
  out.store = await q(`SELECT id, name, is_open FROM public.stores WHERE name ILIKE '%cantinho%silvia%';`);
  out.balance = await q(`SELECT * FROM public.store_balances WHERE store_id = ${sid};`);
  out.delivery_orders_recent = await q(`
    SELECT order_number, status, delivery_fee, payment_method, collection_validated,
           to_char(created_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') AS quando
    FROM public.orders
    WHERE store_id = ${sid}
      AND (order_source IS NULL OR order_source <> 'pdv')
      AND created_at >= now() - interval '7 days'
    ORDER BY created_at DESC;
  `);
  out.fee_sum_delivery_finalizado = await q(`
    SELECT COALESCE(SUM(delivery_fee),0) AS total_taxas, COUNT(*) AS pedidos
    FROM public.orders
    WHERE store_id = ${sid}
      AND (order_source IS NULL OR order_source <> 'pdv')
      AND status = 'finalizado'
      AND created_at >= now() - interval '30 days';
  `);
  out.today_summary = await q(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE order_source='pdv') AS pdv,
      COUNT(*) FILTER (WHERE order_source IS NULL OR order_source<>'pdv') AS delivery,
      COUNT(*) FILTER (WHERE status='finalizado') AS finalizado,
      COUNT(*) FILTER (WHERE status='cancelado') AS cancelado,
      COUNT(*) FILTER (WHERE status NOT IN ('finalizado','cancelado')) AS em_andamento,
      COALESCE(SUM(total_price),0) AS faturamento,
      COALESCE(SUM(delivery_fee),0) AS taxas_entrega
    FROM public.orders
    WHERE store_id = ${sid}
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${today};
  `);
  out.today_orders = await q(`
    SELECT order_number, status, order_source, payment_method, total_price, delivery_fee,
           to_char(created_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS hora
    FROM public.orders
    WHERE store_id = ${sid}
      AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${today}
    ORDER BY created_at DESC;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
