/**
 * Endpoint de observabilidade mantido para agendamentos legados.
 *
 * A política executável está em auto-charge-physical-fees:
 * - PIX semanal quando o ciclo atinge R$ 150;
 * - bloqueio a partir de R$ 500 ou após 30 dias da cobrança mais antiga;
 * - reativação após quitação integral pelo webhook de pagamento.
 */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(JSON.stringify({
    success: true,
    deprecated: true,
    message: "Verificação legada sem efeito. Aplique a política unificada em auto-charge-physical-fees.",
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
