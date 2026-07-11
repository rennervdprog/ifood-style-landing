const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.store = await q(`SELECT id,name,plan_type,legacy_pdv FROM public.stores WHERE name ILIKE '%cantinho%silv%' OR name ILIKE '%silvia%';`);
  out.orders_yday = await q(`
    SELECT o.* FROM public.orders o
    JOIN public.stores s ON s.id=o.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND o.created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 day')
      AND o.created_at < (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND o.status = 'saiu_entrega'
    ORDER BY o.created_at DESC;
  `);
  out.driver_earnings_today = await q(`
    SELECT de.* FROM public.driver_earnings de
    JOIN public.orders o ON o.id=de.order_id
    JOIN public.stores s ON s.id=o.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND de.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  `);
  out.store_driver_earnings_today = await q(`
    SELECT sde.* FROM public.store_driver_earnings sde
    JOIN public.orders o ON o.id=sde.order_id
    JOIN public.stores s ON s.id=o.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND sde.created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
