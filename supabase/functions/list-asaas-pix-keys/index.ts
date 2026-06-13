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
  const url = new URL(req.url);
  if (url.searchParams.get("create") === "evp") {
    const c = await fetch(`${baseUrl}/pix/addressKeys`, {
      method: "POST",
      headers: { access_token: key, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "EVP" }),
    });
    const cd = await c.json().catch(() => ({}));
    return new Response(JSON.stringify({ env: isProd ? "prod" : "sandbox", status: c.status, created: cd }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const r = await fetch(`${baseUrl}/pix/addressKeys?limit=100`, { headers: { access_token: key } });
  const data = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({ env: isProd ? "prod" : "sandbox", status: r.status, data }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});