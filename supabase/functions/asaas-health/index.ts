/**
 * asaas-health — endpoint público de diagnóstico do Asaas (rodar no externo).
 * Faz uma chamada read-only (/myAccount) usando ASAAS_API_KEY pra confirmar:
 *   - secret está configurado
 *   - chave é válida (200)
 *   - ambiente (prod ou sandbox)
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get("ASAAS_API_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

  if (!key) return json({ ok: false, error: "ASAAS_API_KEY not set" }, 500);

  // Heurística do ambiente (prod começa com $aact_prod_)
  const isProd = key.startsWith("$aact_prod_");
  const baseUrl = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  try {
    const r = await fetch(`${baseUrl}/myAccount`, {
      headers: { access_token: key, "User-Agent": "ItaSuper-Health/1.0" },
    });
    const data = await r.json().catch(() => ({}));
    return json({
      ok: r.ok,
      env: isProd ? "production" : "sandbox",
      base_url: baseUrl,
      asaas_status: r.status,
      webhook_token_configured: !!webhookToken,
      account: r.ok
        ? {
            id: data?.id,
            name: data?.name,
            email: data?.email,
            cpfCnpj: data?.cpfCnpj,
            personType: data?.personType,
            company: data?.company,
          }
        : data,
    }, r.ok ? 200 : 500);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});