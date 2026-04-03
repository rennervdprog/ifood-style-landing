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
    const expectedToken = Deno.env.get("ASAAS_API_KEY");

    if (!expectedToken) {
      console.error("ASAAS_API_KEY not configured");
      return json({ error: "Not configured" }, 500);
    }

    // Asaas sends the access token in the header for webhook validation
    // If configured, validate it matches
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

        // Track 15% commission for online payments
        if (order.store_id && order.subtotal) {
          const commission = Math.round(Number(order.subtotal) * 0.15 * 100) / 100;
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
            // Try increment approach
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
          console.log(`Commission R$${commission} tracked for store ${order.store_id}`);
        }
      } else {
        // This is a financial transaction (commission charge, etc.)
        const { error: txError } = await supabase
          .from("financial_transactions")
          .update({
            status: "approved",
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            mercado_pago_payment_id: paymentId,
          })
          .eq("reference_code", externalReference)
          .eq("status", "pending");

        if (txError) {
          console.error("Error updating financial transaction:", txError);
        } else {
          console.log(`Financial transaction ${externalReference} confirmed via Asaas`);
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
