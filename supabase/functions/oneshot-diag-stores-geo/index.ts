const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const q = `select=id,name,latitude,longitude,address_city&or=(name.ilike.*Ric*Burguer*,name.ilike.*Pastelao*)`;
  const r = await fetch(`${url}/rest/v1/stores_public?${q}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});
