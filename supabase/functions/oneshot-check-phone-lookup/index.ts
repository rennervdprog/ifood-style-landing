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
  const out: any = {};
  // recent whatsapp orders
  out.recent_wa_orders = await q(`SELECT id, display_code, customer_phone, customer_name, client_id, created_at FROM public.orders WHERE order_source='whatsapp_bot' ORDER BY created_at DESC LIMIT 10;`);
  // profiles matching those phones
  out.profiles = await q(`SELECT user_id, phone, full_name, updated_at FROM public.profiles WHERE phone IN (SELECT customer_phone FROM public.orders WHERE order_source='whatsapp_bot' ORDER BY created_at DESC LIMIT 10) ORDER BY updated_at DESC LIMIT 20;`);
  // sample: try lookup as bot would
  out.sample_lookup = await q(`SELECT p.user_id, p.phone, p.full_name FROM public.profiles p JOIN (SELECT DISTINCT customer_phone FROM public.orders WHERE order_source='whatsapp_bot' ORDER BY customer_phone) o ON o.customer_phone = p.phone;`);
  // sessions
  out.recent_sessions = await q(`SELECT store_id, phone, current_step, context->>'customer_name' as cn, context->>'client_id' as cid, updated_at FROM public.whatsapp_bot_sessions ORDER BY updated_at DESC LIMIT 10;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});