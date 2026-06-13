const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) return new Response(JSON.stringify({ ok: false, error: "no key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const isProd = key.startsWith("$aact_prod_");
  const baseUrl = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const r = await fetch(`${baseUrl}/pix/addressKeys?limit=100`, { headers: { access_token: key } });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({ env: isProd ? "prod" : "sandbox", status: r.status, data }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});