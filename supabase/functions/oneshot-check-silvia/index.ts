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
  const scope = `((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 day')`;
  const scopeEnd = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
  out.orders_yday_all = await q(`
    SELECT o.id, o.order_number, o.status, o.total_price, o.commission_rate, o.delivery_fee,
           o.delivery_confirmed_by_client, o.collection_validated, o.created_at, o.updated_at
    FROM public.orders o JOIN public.stores s ON s.id=o.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND o.created_at >= ${scope} AND o.created_at < ${scopeEnd}
    ORDER BY o.created_at;
  `);
  out.plan = await q(`
    SELECT sp.store_id, sp.plan_type, sp.is_active, sp.commission_rate, sp.monthly_fee,
           sp.pdv_commission_pending, sb.repasse_pendente, sb.comissao_pendente
    FROM public.store_plans sp
    LEFT JOIN public.store_balances sb ON sb.store_id=sp.store_id
    JOIN public.stores s ON s.id=sp.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%') AND sp.is_active;
  `);
  out.finalize_stuck = await q(`
    UPDATE public.orders o
    SET status='concluido', delivery_confirmed_by_client=true, collection_validated=true,
        completed_at=COALESCE(o.completed_at, now()), updated_at=now()
    FROM public.stores s
    WHERE o.store_id=s.id
      AND (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND o.created_at >= ${scope} AND o.created_at < ${scopeEnd}
      AND o.status='saiu_entrega'
    RETURNING o.id, o.order_number, o.total_price, o.commission_rate;
  `);
  out.after_orders = await q(`
    SELECT o.id, o.order_number, o.status, o.total_price, o.commission_rate
    FROM public.orders o JOIN public.stores s ON s.id=o.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%')
      AND o.created_at >= ${scope} AND o.created_at < ${scopeEnd}
    ORDER BY o.created_at;
  `);
  out.after_balances = await q(`
    SELECT sb.* FROM public.store_balances sb JOIN public.stores s ON s.id=sb.store_id
    WHERE (s.name ILIKE '%cantinho%silv%' OR s.name ILIKE '%silvia%');
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
