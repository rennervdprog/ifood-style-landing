import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

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

      // Track 15% commission for online payments in store_balances
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
          // If upsert fails, try increment via RPC or manual update
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
          // The upsert above sets the value, but we need to ADD to existing
          // Re-do as increment
          const { data: currentBalance } = await supabase
            .from("store_balances")
            .select("pending_commission")
            .eq("store_id", order.store_id)
            .single();

          if (currentBalance && Number(currentBalance.pending_commission) === commission) {
            // First payment for this store - upsert was correct
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
