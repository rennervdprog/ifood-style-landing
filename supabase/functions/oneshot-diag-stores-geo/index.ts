const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t, status: r.status }; }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.stores = await q(`SELECT name, city, latitude, longitude, cep, address, max_delivery_km FROM public.stores WHERE name ILIKE '%Ric Burguer%' OR name ILIKE '%Pastelao Carioca%' OR name ILIKE '%Pastelão Carioca%';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
