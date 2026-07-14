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
  out.orders_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' ORDER BY column_name;`);
  out.profiles_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY column_name;`);
  out.sessions_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='whatsapp_bot_sessions' ORDER BY column_name;`);
  out.recent_sessions = await q(`SELECT * FROM public.whatsapp_bot_sessions ORDER BY created_at DESC LIMIT 5;`);
  out.recent_profiles_with_phone = await q(`SELECT user_id, phone, full_name, delivery_pin FROM public.profiles WHERE phone IS NOT NULL AND phone <> '' ORDER BY created_at DESC LIMIT 10;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});