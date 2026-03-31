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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { order_id, items, total, payer_email, payer_name, store_name } = body;

    if (!order_id || !items || !total) {
      return new Response(JSON.stringify({ error: "Missing required fields: order_id, items, total" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verify the order belongs to this user
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, client_id, total_price")
      .eq("id", order_id)
      .eq("client_id", userId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found or access denied" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const projectId = Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "") || "";

    const orderLabel = store_name 
      ? `Pedido #${order_id.substring(0, 6).toUpperCase()} - ${store_name}`
      : `Pedido ItaFood #${order_id.substring(0, 6).toUpperCase()}`;

    const preferenceBody = {
      items: items.map((item: any) => ({
        title: String(item.title || orderLabel).substring(0, 256),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        currency_id: "BRL",
      })),
      payer: {
        email: payer_email || undefined,
        name: payer_name || undefined,
      },
      external_reference: order_id,
      back_urls: {
        success: `https://${projectId}.supabase.co/functions/v1/mp-return?status=success&order_id=${order_id}`,
        failure: `https://${projectId}.supabase.co/functions/v1/mp-return?status=failure&order_id=${order_id}`,
        pending: `https://${projectId}.supabase.co/functions/v1/mp-return?status=pending&order_id=${order_id}`,
      },
      auto_return: "approved",
      default_payment_method_id: "pix",
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" },
          { id: "atm" },
        ],
        installments: 1,
      },
      statement_descriptor: "ITAFOOD",
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP Error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Failed to create payment preference" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        init_point: mpData.init_point,
        preference_id: mpData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
