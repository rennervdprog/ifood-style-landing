/**
 * cancel-order-refund
 *
 * Cancela um pedido pelo lojista, aplicando a política de reembolso
 * (via RPC `apply_cancellation_policy`, que checa permissão + credita
 * carteira do cliente) e, quando o pagamento é PIX Online, dispara o
 * estorno automático via API Asaas.
 *
 * Body: { order_id: string, cancel_reason: keyof CANCEL_REASONS }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
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

async function refundAsaasPayment(paymentId: string, apiKey: string) {
  const baseUrl = apiKey.startsWith("$aact_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
  try {
    const checkRes = await fetch(`${baseUrl}/payments/${paymentId}`, {
      headers: { access_token: apiKey },
    });
    if (!checkRes.ok) return { ok: false, error: `Pagamento não encontrado: ${checkRes.status}` };
    const payment = await checkRes.json();
    if (!["CONFIRMED", "RECEIVED"].includes(payment.status)) {
      return { ok: true, error: `Status ${payment.status} — estorno não necessário` };
    }
    const refundRes = await fetch(`${baseUrl}/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({ description: "Cancelamento pelo lojista" }),
    });
    if (!refundRes.ok) {
      const err = await refundRes.json().catch(() => ({}));
      return { ok: false, error: err?.errors?.[0]?.description || `Erro Asaas ${refundRes.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // 🔁 EXTERNAL DB: pedidos/lojas ficam no Supabase EXTERNO. Cancelamento
    // + reembolso precisam operar contra o mesmo projeto para respeitar a
    // política de cancelamento contratual (cláusula 10).
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")
      || Deno.env.get("SUPABASE_ANON_KEY")
      || svc;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const body = await req.json().catch(() => ({} as any));
    const order_id = body?.order_id as string | undefined;
    const cancel_reason = body?.cancel_reason as string | undefined;
    if (!order_id) return json({ error: "order_id obrigatório" }, 400);
    const reasonLabel = cancel_reason ? CANCEL_REASONS[cancel_reason] : undefined;
    if (!reasonLabel) {
      return json({ error: "Motivo inválido", valid_reasons: Object.keys(CANCEL_REASONS) }, 400);
    }

    // Client com o auth do usuário — a RPC valida permissão via auth.uid()
    // (owner da loja, admin da plataforma ou cliente do pedido).
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, svc, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, status, payment_method, store_id, asaas_payment_id")
      .eq("id", order_id)
      .maybeSingle();
    if (oErr) return json({ error: `Erro ao carregar pedido: ${oErr.message}` }, 500);
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (["cancelado", "finalizado", "entregue"].includes(order.status)) {
      return json({ error: `Pedido já está ${order.status}` }, 400);
    }

    // Aplica cancelamento + política de reembolso (crédito na carteira, etc).
    const { data: rpcData, error: rpcErr } = await asUser.rpc("apply_cancellation_policy", {
      _order_id: order_id,
      _reason: reasonLabel,
    });
    if (rpcErr) return json({ error: rpcErr.message || "Falha ao cancelar" }, 403);

    // Persiste a chave curta em cancel_reason (o app mapeia para label na UI)
    // e marca cancelled_by='lojista'.
    await admin
      .from("orders")
      .update({ cancel_reason, cancelled_by: "lojista" })
      .eq("id", order_id);

    // Estorno automático Asaas para PIX Online
    let refund_status: string | null = null;
    let refund_error: string | null = null;
    const isPixOnline = order.payment_method === "pix";
    if (isPixOnline) {
      if (order.asaas_payment_id) {
        const { data: store } = await admin
          .from("stores")
          .select("asaas_subaccount_api_key")
          .eq("id", order.store_id)
          .maybeSingle();
        if (store?.asaas_subaccount_api_key) {
          const r = await refundAsaasPayment(order.asaas_payment_id, store.asaas_subaccount_api_key);
          refund_status = r.ok ? "processed" : "failed";
          refund_error = r.error || null;
        } else {
          refund_status = "pending";
        }
      } else {
        refund_status = "pending";
      }
      await admin.from("orders").update({ refund_status }).eq("id", order_id);
    }

    let message = `Pedido cancelado. Motivo: ${reasonLabel}.`;
    if (isPixOnline) {
      if (refund_status === "processed") message += " Reembolso PIX processado via Asaas.";
      else if (refund_status === "failed") message += ` Reembolso PIX falhou (${refund_error}). Faça o estorno manualmente.`;
      else message += " Reembolso PIX pendente — faça o estorno manualmente no Asaas.";
    } else {
      message += " Pagamento físico — nenhum estorno pela plataforma.";
    }

    return json({
      success: true,
      message,
      refund_status,
      reason: reasonLabel,
      is_pix_online: isPixOnline,
      rpc: rpcData,
    });
  } catch (err: any) {
    console.error("[cancel-order-refund]", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});