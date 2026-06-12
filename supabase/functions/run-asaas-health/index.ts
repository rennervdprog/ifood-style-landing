const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) return new Response(JSON.stringify({ ok: false, error: "ASAAS_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const isProd = key.startsWith("$aact_prod_");
  const baseUrl = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  try {
    const r = await fetch(`${baseUrl}/myAccount`, { headers: { access_token: key, "User-Agent": "ItaSuper-Health/1.0" } });
    const data = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({
      ok: r.ok,
      env: isProd ? "production" : "sandbox",
      base_url: baseUrl,
      asaas_status: r.status,
      webhook_token_configured: !!Deno.env.get("ASAAS_WEBHOOK_TOKEN"),
      account: r.ok ? { id: data?.id, name: data?.name, email: data?.email, cpfCnpj: data?.cpfCnpj, personType: data?.personType, company: data?.company } : data,
    }, null, 2), { status: r.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});