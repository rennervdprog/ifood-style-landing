const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const q = `select=id,name,latitude,longitude,address_city,address_cep,status,is_visible,plan_type&or=(name.ilike.*Ric*,name.ilike.*Pastelao*,name.ilike.*Pastelão*,address_city.ilike.*Búzios*,address_city.ilike.*Buzios*)`;
  const r = await fetch(`${url}/rest/v1/stores?${q}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});
