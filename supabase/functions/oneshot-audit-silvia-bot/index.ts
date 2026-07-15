const cors = { "Access-Control-Allow-Origin": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const store = await q(`SELECT id, name, slug FROM public.stores WHERE name ILIKE '%cantinho%silv%' OR name ILIKE '%silvia%' LIMIT 3;`);
  const sid = store?.[0]?.id;
  const out: any = { store };
  if (sid) {
    out.sections = await q(`SELECT id, name FROM public.menu_sections WHERE store_id='${sid}' ORDER BY name;`);
    out.products_count = await q(`SELECT count(*) FROM public.products WHERE store_id='${sid}' AND is_active=true;`);
    out.products_sample = await q(`SELECT id, name, price, is_active FROM public.products WHERE store_id='${sid}' AND is_active=true ORDER BY name LIMIT 20;`);
    out.addon_groups = await q(`SELECT ag.id, ag.name, ag.min_select, ag.max_select, count(ai.id) items FROM public.addon_groups ag LEFT JOIN public.addon_items ai ON ai.group_id=ag.id WHERE ag.store_id='${sid}' GROUP BY ag.id ORDER BY ag.name;`);
    out.pizza_borders = await q(`SELECT id, name, price FROM public.pizza_borders WHERE store_id='${sid}';`);
    out.opening_hours = await q(`SELECT day_of_week, open_time, close_time, is_closed_all_day FROM public.opening_hours WHERE store_id='${sid}' ORDER BY day_of_week;`);
    out.bot_config = await q(`SELECT * FROM public.whatsapp_bot_config WHERE store_id='${sid}';`);
    out.payment_settings = await q(`SELECT accepts_pix_online, accepts_pix_machine, accepts_pix_direct, accepts_credit, accepts_debit, accepts_cash, pix_direct_key, pix_direct_key_type FROM public.stores WHERE id='${sid}';`);
    out.delivery_config = await q(`SELECT delivery_fee, own_delivery_fee, accepts_own_delivery, accepts_pickup, min_order_value FROM public.stores WHERE id='${sid}';`);
    out.neighborhood_fees = await q(`SELECT neighborhood, fee FROM public.neighborhood_fees WHERE store_id='${sid}' LIMIT 20;`);
    out.product_addon_groups = await q(`SELECT count(*) FROM public.product_addon_groups pag JOIN public.products p ON p.id=pag.product_id WHERE p.store_id='${sid}';`);
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
