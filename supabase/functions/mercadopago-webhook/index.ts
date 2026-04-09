import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validate x-signature header from Mercado Pago
async function validateWebhookSignature(
  req: Request,
  body: string
): Promise<boolean> {
  const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!ACCESS_TOKEN) return false;

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    console.warn("Missing x-signature or x-request-id headers");
    return false;
  }

  // Parse x-signature: "ts=...,v1=..."
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) {
    console.warn("Invalid x-signature format");
    return false;
  }

  // Parse body to get data.id for the manifest
  let dataId: string | undefined;
  try {
    const parsed = JSON.parse(body);
    dataId = parsed?.data?.id?.toString();
  } catch {
    return false;
  }

  // Build the manifest string per MP docs
  // template: "id:[data.id];request-id:[x-request-id];ts:[ts];"
  const manifest = `id:${dataId || ""};request-id:${xRequestId};ts:${ts};`;

  // HMAC-SHA256 with the access token as secret
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ACCESS_TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed !== v1) {
    console.warn("HMAC signature mismatch — possible forged webhook");
    return false;
  }

  return true;
}

const WebhookBodySchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]).optional(),
  }).optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Validate HMAC signature
    const isValid = await validateWebhookSignature(req, rawBody);
    if (!isValid) {
      console.error("Webhook signature validation failed — rejecting request");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = WebhookBodySchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parsed.data;
    console.log("Webhook received (verified):", JSON.stringify({ type: body.type, action: body.action, data_id: body.data?.id }));

    // Mercado Pago sends different notification types
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "No payment ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      console.error("MERCADO_PAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details from Mercado Pago
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );

    if (!paymentResponse.ok) {
      console.error("Failed to fetch payment from MP:", paymentResponse.status);
      return new Response(JSON.stringify({ error: "Failed to verify payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await paymentResponse.json();
    console.log("Payment details:", JSON.stringify({
      status: payment.status,
      external_reference: payment.external_reference,
      transaction_amount: payment.transaction_amount,
    }));

    const orderId = payment.external_reference;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "No order reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to update order status (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (payment.status === "approved") {
      // Fetch order to get store_id and subtotal for commission tracking
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("id, status, store_id, subtotal, payment_method")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        console.error("Order not found:", orderId, fetchError);
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only update if still awaiting payment (idempotency)
      if (order.status !== "aguardando_pagamento") {
        console.log(`Order ${orderId} already processed (status: ${order.status}), skipping`);
        return new Response(JSON.stringify({ received: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Payment confirmed → set to pendente + record confirmed_at
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "pendente" as any,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order:", updateError);
      } else {
        console.log(`Order ${orderId} payment confirmed, status → pendente, confirmed_at set`);
      }

      // Track commission using store's custom rate
      if (order.store_id && order.subtotal) {
        const { data: storeInfo } = await supabase.from("stores").select("commission_rate").eq("id", order.store_id).single();
        const rate = (storeInfo?.commission_rate ?? 15) / 100;
        const commission = Math.round(Number(order.subtotal) * rate * 100) / 100;
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
          console.error("Error upserting balance, trying increment:", balanceError);
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
            await supabase
              .from("store_balances")
              .insert({
                store_id: order.store_id,
                pending_commission: commission,
                updated_at: new Date().toISOString(),
              });
          }
        } else {
          const { data: currentBalance } = await supabase
            .from("store_balances")
            .select("pending_commission")
            .eq("store_id", order.store_id)
            .single();

          if (currentBalance && Number(currentBalance.pending_commission) === commission) {
            console.log(`Store ${order.store_id} commission set: R$${commission}`);
          }
        }

        console.log(`Commission R$${commission} tracked for store ${order.store_id}`);
      }
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      console.log(`Payment ${paymentId} was ${payment.status} for order ${orderId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
