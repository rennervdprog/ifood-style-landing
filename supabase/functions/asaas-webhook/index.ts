/**
 * asaas-webhook
 *
 * Recebe eventos do Asaas e atualiza o estado das cobranças.
 * Trata 3 tipos de cobrança:
 *  1. MENSALIDADE (#MENS-..., #ASSIN-...) → avança next_billing_date e zera comissão PDV cobrada
 *  2. TAXAS FÍSICAS (auto-charge-physical-fees) → zera repasse_pendente / comissao_pendente
 *  3. PEDIDO PIX (externalReference = order_id) → confirma pedido e dispara split (delegado a confirm-order-payment)
 *
 * IMPORTANTE: este endpoint é PÚBLICO (verify_jwt=false). A autenticação é feita
 * comparando o header `asaas-access-token` com o secret `ASAAS_WEBHOOK_TOKEN`.
 * Se o secret não estiver configurado, aceita qualquer chamada (modo permissivo p/ debug).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Eventos que indicam pagamento confirmado
const PAID_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

const FAILED_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ─── Auth via webhook token ───
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  const receivedToken = req.headers.get("asaas-access-token") || "";
  if (!expectedToken) {
    console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado — rejeitando todas as chamadas");
    return json({ error: "Webhook not configured" }, 500);
  }
  if (receivedToken !== expectedToken) {
    console.warn("[asaas-webhook] Invalid token");
    return json({ error: "Unauthorized" }, 401);
  }

  // ─── Setup external DB client ───
  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event: string = payload?.event || "";
  const payment = payload?.payment || payload?.transfer || {};
  const paymentId: string | undefined = payment?.id;
  const externalRef: string | undefined = payment?.externalReference;

  console.log(`[asaas-webhook] event=${event} paymentId=${paymentId} extRef=${externalRef}`);

  // ─── Idempotência: bloqueia reprocessamento do mesmo evento ───
  const eventId: string | undefined = payload?.id || payload?.event_id;
  if (eventId) {
    const { error: dupErr } = await supabase
      .from("asaas_webhook_events")
      .insert({ event_id: eventId, event_type: event, payment_id: paymentId, payload });
    if (dupErr) {
      const msg = String(dupErr.message || "");
      if (msg.includes("duplicate") || msg.includes("unique") || (dupErr as any).code === "23505") {
        console.log(`[asaas-webhook] duplicate event ${eventId} — ignored`);
        return json({ ok: true, idempotent: true, event_id: eventId });
      }
      console.error("[asaas-webhook] event log error", dupErr);
    }
  }

  // ─── Eventos de TRANSFER (repasses para lojistas/motoboys) ───
  if (event?.startsWith("TRANSFER_")) {
    console.log(`[asaas-webhook] transfer event ${event} for ${paymentId} — log only`);
    return json({ ok: true, event, type: "transfer_log" });
  }

  if (!event || !paymentId) {
    return json({ ok: true, ignored: "no_event_or_payment" });
  }

  // ─── PEDIDO PIX (cliente comprando na loja) ───
  // Asaas envia externalReference = order_id quando é pedido. Delegamos ao
  // mesmo fluxo do polling (confirm-order-payment) reutilizando a função.
  const isOrderPayment = !!externalRef && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(externalRef);
  if (isOrderPayment && PAID_EVENTS.has(event)) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, store_payout_id")
        .eq("id", externalRef)
        .maybeSingle();

      if (order && order.status === "aguardando_pagamento") {
        await supabase
          .from("orders")
          .update({ status: "pendente", confirmed_at: new Date().toISOString() })
          .eq("id", externalRef)
          .eq("status", "aguardando_pagamento");
        console.log(`[asaas-webhook] order ${externalRef} → pendente`);
      }

      // Trigger split via confirm-order-payment using service-role bypass,
      // so the store gets paid even when the user closes the app right after PIX.
      try {
        // confirm-order-payment vive na MESMA edge platform (Lovable);
        // SUPABASE_URL aqui é a URL das functions do projeto Lovable, não do banco.
        // O banco em si já é o externo (cliente `supabase` acima).
        const projectUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        await fetch(`${projectUrl}/functions/v1/confirm-order-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "x-webhook-bypass": "asaas",
          },
          body: JSON.stringify({ order_id: externalRef }),
        });
      } catch (splitErr) {
        console.error("[asaas-webhook] split trigger failed", splitErr);
      }
      return json({ ok: true, type: "order_payment", order_id: externalRef });
    } catch (e) {
      console.error("[asaas-webhook] order update error", e);
      return json({ ok: true, error: String(e) });
    }
  }

  // ─── PEDIDO: pagamento falhou / vencido / reembolsado ───
  // Sem isso, REFUNDED/OVERDUE de um pedido caem no fluxo de financial_transactions
  // (que não existe para pedidos) e o pedido fica preso em "pendente".
  if (isOrderPayment && FAILED_EVENTS.has(event)) {
    try {
      const isRefund = event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED";
      const newStatus = isRefund ? "cancelado" : "cancelado"; // pedido sempre cancelado quando pagamento não vinga
      const { data: order } = await supabase
        .from("orders").select("id, status").eq("id", externalRef).maybeSingle();
      if (!order) return json({ ok: true, ignored: "order_not_found" });

      // Só altera se ainda não foi entregue/finalizado
      const terminal = ["entregue", "finalizado", "cancelado"];
      if (terminal.includes(String(order.status))) {
        return json({ ok: true, idempotent: true, order_id: externalRef, status: order.status });
      }
      await supabase.from("orders").update({
        status: newStatus,
        cancel_reason: isRefund ? "Pagamento reembolsado pelo Asaas" : `Pagamento ${event}`,
      }).eq("id", externalRef);
      console.log(`[asaas-webhook] order ${externalRef} → ${newStatus} (${event})`);
      return json({ ok: true, type: "order_payment_failed", order_id: externalRef, event });
    } catch (e) {
      console.error("[asaas-webhook] order refund/fail error", e);
      return json({ ok: true, error: String(e) });
    }
  }

  // ─── Localizar a financial_transaction ───
  // Pode estar em mercado_pago_payment_id (monthly-billing/subscribe) OU
  // em reference_code (auto-charge-physical-fees salva o paymentId aí).
  let { data: tx } = await supabase
    .from("financial_transactions")
    .select("id, store_id, status, amount, reference_code, transaction_kind, metadata")
    .eq("mercado_pago_payment_id", paymentId)
    .maybeSingle();

  if (!tx) {
    const { data: tx2 } = await supabase
      .from("financial_transactions")
      .select("id, store_id, status, amount, reference_code, transaction_kind, metadata")
      .eq("reference_code", paymentId)
      .maybeSingle();
    tx = tx2;
  }

  if (!tx) {
    console.log(`[asaas-webhook] no transaction for paymentId ${paymentId} — ignoring`);
    return json({ ok: true, ignored: "transaction_not_found", payment_id: paymentId });
  }

  // Idempotência — não reprocessar se já está paga
  if (tx.status === "paid" && PAID_EVENTS.has(event)) {
    return json({ ok: true, idempotent: true, transaction_id: tx.id });
  }

  // ─── PAGAMENTO CONFIRMADO ───
  if (PAID_EVENTS.has(event)) {
    const nowIso = new Date().toISOString();

    // 1) marca a transação como paga ATOMICAMENTE (guard: status != 'paid').
    //    Se 0 linhas afetadas, outro worker já processou — encerra idempotente.
    const { data: updRows, error: updErr } = await supabase
      .from("financial_transactions")
      .update({ status: "paid", settled_at: nowIso })
      .eq("id", tx.id)
      .neq("status", "paid")
      .select("id");
    if (updErr) {
      console.error("[asaas-webhook] tx update error", updErr);
      return json({ ok: false, error: "tx_update_failed" }, 500);
    }
    if (!updRows || updRows.length === 0) {
      console.log(`[asaas-webhook] tx ${tx.id} already paid by concurrent worker — idempotent`);
      return json({ ok: true, idempotent: true, transaction_id: tx.id });
    }

    const ref = String(tx.reference_code || "");
    const isMonthly = ref.startsWith("#MENS-") || ref.startsWith("#ASSIN-");

    if (isMonthly) {
      // 2a) avança ciclo de cobrança da loja
      const next = new Date();
      next.setUTCDate(next.getUTCDate() + 30);
      const { error: planErr } = await supabase
        .from("store_plans")
        .update({
          last_billed_at: nowIso,
          next_billing_date: next.toISOString(),
          last_billing_attempt_at: null, // libera próxima cobrança quando vencer
        })
        .eq("store_id", tx.store_id)
        .eq("is_active", true);
      if (planErr) console.error("[asaas-webhook] plan update error", planErr);
      // Zera comissão PDV apenas APÓS confirmação (era zerada antes em monthly-billing).
      // Subtrai o valor exato cobrado, preservando comissão acumulada entre fatura e pagamento.
      const pdvBilled = Number((tx.metadata as any)?.pdv_pending_billed || 0);
      if (pdvBilled > 0) {
        const { error: pdvErr } = await supabase.rpc("decrement_pdv_commission_pending", {
          _store_id: tx.store_id,
          _amount: pdvBilled,
        });
        if (pdvErr) console.error("[asaas-webhook] pdv decrement error", pdvErr);
      }
      console.log(`[asaas-webhook] mensalidade paga store=${tx.store_id} próxima=${next.toISOString()}`);
    } else {
      // 2b) cobrança de taxa física (auto-charge-physical-fees) → zera saldos
      // Débito atômico via RPC com FOR UPDATE — elimina race com reconcile-payments
      // e com webhooks concorrentes que antes liam→escreviam sem lock.
      const meta: any = tx.metadata || {};
      const planType: string = meta.plan_type || "";
      const paidAmount = Number(tx.amount || 0);
      // Split: balance bucket (repasse + comissão) vs PDV bucket.
      // store-platform-fee-pix grava balance_billed / pdv_pending_billed em metadata.
      const balanceBilled = Number(meta.balance_billed ?? paidAmount);
      const pdvBilled = Number(meta.pdv_pending_billed ?? 0);
      if (balanceBilled > 0) {
        const { error: balErr } = await supabase.rpc("reconcile_debit_store_balance", {
          _store_id: tx.store_id,
          _amount: balanceBilled,
          _plan_type: planType,
        });
        if (balErr) console.error("[asaas-webhook] debit rpc error", balErr);
      }
      if (pdvBilled > 0) {
        const { error: pdvErr } = await supabase.rpc("decrement_pdv_commission_pending", {
          _store_id: tx.store_id,
          _amount: pdvBilled,
        });
        if (pdvErr) console.error("[asaas-webhook] pdv decrement error", pdvErr);
      }
      console.log(`[asaas-webhook] taxa física paga store=${tx.store_id} plan=${planType} valor=${paidAmount}`);
    }

    return json({ ok: true, type: "payment_confirmed", transaction_id: tx.id });
  }

  // ─── PAGAMENTO FALHOU / VENCEU ───
  if (FAILED_EVENTS.has(event)) {
    const newStatus = event === "PAYMENT_REFUNDED" ? "cancelled" : "failed";
    await supabase
      .from("financial_transactions")
      .update({ status: newStatus })
      .eq("id", tx.id);
    console.log(`[asaas-webhook] tx ${tx.id} → ${newStatus} (${event})`);
    return json({ ok: true, type: "payment_failed", status: newStatus });
  }

  // Outros eventos (PAYMENT_CREATED, PAYMENT_UPDATED, etc.) — só log
  return json({ ok: true, ignored: event });
});