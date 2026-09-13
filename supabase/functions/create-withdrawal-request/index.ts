/**
 * DESATIVADA — saque de motoboy é legado do modelo antigo.
 *
 * O ItaSuper é o software que conecta lojista e motoboy: não remunera
 * entregador e não mantém saldo dele. O valor de cada entrega é combinado e
 * pago diretamente entre lojista e motoboy, fora da plataforma. Ver
 * "Não vinculação" nos Termos de Uso.
 *
 * A function responde 410 Gone para qualquer chamada. `driver_balances`,
 * `driver_earnings` e `withdrawal_requests` de motoboy seguem no banco apenas
 * como histórico — não devem voltar a receber escrita.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error:
        "O ItaSuper não faz repasse a entregadores. O acerto da entrega é combinado e pago diretamente com a loja.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
