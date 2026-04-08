import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Asaas webhook payload schema
const WebhookSchema = z.object({
  event: z.string(),
  payment: z.object({
    id: z.string(),
    status: z.string(),
    value: z.number().optional(),
    externalReference: z.string().optional().nullable(),
    billingType: z.string().optional(),
  }).optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Validate the webhook token from Asaas
    const asaasToken = req.headers.get("asaas-access-token");
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const apiKey = Deno.env.get("ASAAS_API_KEY");

    // Validate using dedicated webhook token or API key
    const expectedToken = webhookToken || apiKey;

    if (!expectedToken) {
      console.error("ASAAS_WEBHOOK_TOKEN/ASAAS_API_KEY not configured");
      return json({ error: "Not configured" }, 500);
    }

    if (asaasToken && asaasToken !== expectedToken) {
      console.warn("Invalid Asaas webhook token");
      return json({ error: "Unauthorized" }, 401);
    }

    const parsed = WebhookSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      console.error("Invalid webhook payload:", parsed.error.flatten());
      return json({ error: "Invalid payload" }, 400);
    }

    const { event, payment } = parsed.data;
    console.log("Asaas webhook received:", JSON.stringify({ event, payment_id: payment?.id, status: payment?.status }));

    // Only process payment events
    if (!event.startsWith("PAYMENT_") || !payment) {
      return json({ received: true });
    }

    const paymentId = payment.id;
    const externalReference = payment.externalReference;

    if (!externalReference) {
      console.log("No external reference, skipping");
      return json({ received: true });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine if this is an order payment or a financial transaction
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalReference);

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (isUuid) {
        // This is an order payment
        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("id, status, store_id, subtotal, payment_method")
          .eq("id", externalReference)
          .single();

        if (fetchError || !order) {
          console.error("Order not found:", externalReference, fetchError);
          return json({ error: "Order not found" }, 404);
        }

        // Idempotency: only update if still awaiting payment
        if (order.status !== "aguardando_pagamento") {
          console.log(`Order ${externalReference} already processed (status: ${order.status})`);
          return json({ received: true, already_processed: true });
        }

        // Payment confirmed → set to pendente
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "pendente" as any,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", externalReference);

        if (updateError) {
          console.error("Error updating order:", updateError);
        } else {
          console.log(`Order ${externalReference} payment confirmed via Asaas, status → pendente`);
        }

        // Track commission for online payments
        if (order.store_id && order.subtotal) {
          // Check store delivery mode to determine commission
          const { data: storeInfo } = await supabase
            .from("stores")
            .select("delivery_mode")
            .eq("id", order.store_id)
            .single();

          const isOwnDelivery = storeInfo?.delivery_mode === "own";
          // Own delivery: fixed R$0.90 platform fee; Platform delivery: 15% of subtotal
          const commission = isOwnDelivery
            ? 0.90
            : Math.round(Number(order.subtotal) * 0.15 * 100) / 100;

          const { error: balanceError } = await supabase
            .from("store_balances")
            .upsert(
              {
                store_id: order.store_id,
                pending_commission: commission,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "store_id" }
            );

          if (balanceError) {
            const { data: existing } = await supabase
              .from("store_balances")
              .select("pending_commission")
              .eq("store_id", order.store_id)
              .single();

            if (existing) {
              await supabase
                .from("store_balances")
                .update({
                  pending_commission: Number(existing.pending_commission) + commission,
                  updated_at: new Date().toISOString(),
                })
                .eq("store_id", order.store_id);
            } else {
              await supabase.from("store_balances").insert({
                store_id: order.store_id,
                pending_commission: commission,
                updated_at: new Date().toISOString(),
              });
            }
          }
          console.log(`Commission R$${commission} tracked for store ${order.store_id} (${isOwnDelivery ? 'own delivery' : 'platform'})`);
        }
      } else {
        // This is a financial transaction (commission charge, etc.)
        const { data: txData, error: txError } = await supabase
          .from("financial_transactions")
          .update({
            status: "approved",
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            mercado_pago_payment_id: paymentId,
          })
          .eq("reference_code", externalReference)
          .eq("status", "pending")
          .select("store_id, transaction_kind, amount")
          .maybeSingle();

        if (txError) {
          console.error("Error updating financial transaction:", txError);
        } else {
          console.log(`Financial transaction ${externalReference} confirmed via Asaas`);

          // Auto-reactivate store if commission was paid
          if (txData?.transaction_kind === "commission_charge" && txData.store_id) {
            const paidAmount = Number(txData.amount) || 0;

            // Reduce pending commission
            const { data: balance } = await supabase
              .from("store_balances")
              .select("comissao_pendente")
              .eq("store_id", txData.store_id)
              .single();

            if (balance) {
              const newPending = Math.max(0, Number(balance.comissao_pendente) - paidAmount);
              await supabase
                .from("store_balances")
                .update({
                  comissao_pendente: newPending,
                  pending_commission: newPending,
                  updated_at: new Date().toISOString(),
                })
                .eq("store_id", txData.store_id);
            }

            // Reactivate store if it was blocked
            const { error: reactivateError } = await supabase
              .from("stores")
              .update({ status: "ativo" })
              .eq("id", txData.store_id)
              .eq("status", "bloqueado");

            if (!reactivateError) {
              console.log(`Store ${txData.store_id} reactivated after commission payment`);

              // Resolve compliance alerts
              await supabase
                .from("compliance_alerts")
                .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                .eq("store_id", txData.store_id)
                .eq("alert_type", "commission_overdue")
                .eq("is_resolved", false);
            }
          }
        }
      }
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      // Payment failed/cancelled
      if (isUuid) {
        console.log(`Asaas payment ${paymentId} was ${event} for order ${externalReference}`);
      } else {
        await supabase
          .from("financial_transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("reference_code", externalReference)
          .eq("status", "pending");
        console.log(`Financial transaction ${externalReference} marked as failed (${event})`);
      }
    }

    return json({ received: true });
  } catch (err) {
    console.error("Asaas webhook error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
