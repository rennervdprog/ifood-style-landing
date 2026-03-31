import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        headers: corsHeaders,
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Fetch payment details from MP
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );

    const payment = await paymentResponse.json();
    console.log("Payment details:", JSON.stringify({ 
      status: payment.status, 
      external_reference: payment.external_reference 
    }));

    const orderId = payment.external_reference;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "No order reference" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Use service role to update order status
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (payment.status === "approved") {
      // Payment confirmed - set order to pendente (ready for store to accept)
      const { error } = await supabase
        .from("orders")
        .update({ status: "pendente" as any })
        .eq("id", orderId);

      if (error) {
        console.error("Error updating order:", error);
      } else {
        console.log(`Order ${orderId} payment confirmed, status set to pendente`);
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
      headers: corsHeaders,
    });
  }
});
