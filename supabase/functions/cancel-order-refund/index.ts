/**
 * cancel-order-refund
 *
 * Endpoint de compatibilidade para cancelamento de pedido. A regra financeira
 * é exclusivamente a RPC apply_cancellation_policy: pagamentos físicos não
 * geram crédito/reembolso na plataforma e PIX Direto confirmado abre um caso
 * de devolução direta pela loja. Não há chamada Asaas nem crédito de carteira.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const CANCEL_REASONS: Record<string, string> = {
  out_of_stock: "Produto esgotado no estoque",
  client_request: "Solicitação do cliente",
  out_of_area: "Fora da área de entrega",
  closed: "Loja fechada / sem entregador",
  other: "Outro motivo",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "Configuração de backend indisponível" }, 500);

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    const shortReason = typeof body.cancel_reason === "string" ? body.cancel_reason : "";
    const reason = CANCEL_REASONS[shortReason];
    if (!orderId) return json({ error: "order_id obrigatório" }, 400);
    if (!reason) return json({ error: "Motivo inválido", valid_reasons: Object.keys(CANCEL_REASONS) }, 400);

    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // A RPC resolve autorização, status do pedido e elegibilidade do PIX Direto
    // dentro da mesma transação no banco.
    const { data: cancellation, error: cancellationError } = await asUser.rpc("apply_cancellation_policy", {
      _order_id: orderId,
      _reason: reason,
    });
    if (cancellationError) return json({ error: cancellationError.message || "Falha ao cancelar pedido" }, 403);

    // O endpoint só complementa o metadado operacional após a autorização já
    // ter sido validada pela RPC; não toma nenhuma decisão financeira.
    const { error: metadataError } = await admin
      .from("orders")
      .update({ cancel_reason: shortReason, cancelled_by: "lojista" })
      .eq("id", orderId);
    if (metadataError) return json({ error: `Pedido cancelado, mas não foi possível registrar o motivo: ${metadataError.message}` }, 500);

    const result = cancellation as { requires_store_refund?: boolean; payment_method?: string; refund_case_id?: string | null; legacy_gateway_refund_required?: boolean } | null;
    const needsDirectRefund = Boolean(result?.requires_store_refund);
    const isLegacyPix = Boolean(result?.legacy_gateway_refund_required);
    const message = needsDirectRefund
      ? "Pedido cancelado. A loja deve devolver o PIX Direto ao cliente e registrar o comprovante no caso aberto."
      : isLegacyPix
        ? "Pedido cancelado. O pagamento PIX legado requer revisão financeira manual; nenhum estorno ou crédito foi executado automaticamente."
        : "Pedido cancelado. Pagamentos físicos não geram reembolso financeiro pela plataforma.";

    return json({
      success: true,
      message,
      payment_method: result?.payment_method || null,
      requires_store_refund: needsDirectRefund,
      refund_case_id: result?.refund_case_id || null,
      legacy_gateway_refund_required: isLegacyPix,
    });
  } catch (error: any) {
    console.error("[cancel-order-refund]", error);
    return json({ error: error?.message || "Erro interno" }, 500);
  }
});
