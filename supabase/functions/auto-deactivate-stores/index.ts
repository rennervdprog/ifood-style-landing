/**
 * Endpoint de compatibilidade.
 *
 * A antiga rotina bloqueava lojas após três dias, em conflito com a política
 * canônica de repasse. O bloqueio agora é tratado somente por
 * auto-charge-physical-fees, com prazo de 30 dias e status reversível.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    success: true,
    deprecated: true,
    message: "Nenhuma loja foi bloqueada. Use auto-charge-physical-fees para a política canônica de repasse.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
