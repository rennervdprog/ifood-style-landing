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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const body = await req.json();
    const { order_id, amount, description, payer_first_name, payer_last_name, payer_cpf } = body;

    if (!order_id || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields: order_id, amount" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (typeof amount !== "number" || amount <= 0 || amount > 100000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verify the order belongs to this user and is awaiting payment
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, client_id, total_price, status")
      .eq("id", order_id)
      .eq("client_id", userId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found or access denied" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (order.status !== "aguardando_pagamento") {
      return new Response(JSON.stringify({ error: "Order is not awaiting payment" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Chave do Mercado Pago não configurada. Peça ao administrador para inserir o MERCADO_PAGO_ACCESS_TOKEN." }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Clean CPF - remove non-digits
    const cleanCpf = String(payer_cpf || "").replace(/\D/g, "");
    if (!cleanCpf || cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido. Informe um CPF com 11 dígitos." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const paymentBody = {
      transaction_amount: Number(amount),
      description: String(description || `Pedido ItaFood #${order_id.substring(0, 6).toUpperCase()}`).substring(0, 256),
      payment_method_id: "pix",
      payer: {
        email: userEmail || "cliente@itafood.com",
        first_name: String(payer_first_name || "Cliente").substring(0, 100),
        last_name: String(payer_last_name || "ItaFood").substring(0, 100),
        identification: {
          type: "CPF",
          number: cleanCpf,
        },
      },
      external_reference: order_id,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": `pix-${order_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP PIX Error:", JSON.stringify(mpData));
      let userMessage = "Erro ao gerar PIX. Tente novamente.";
      if (mpData?.message?.includes("access_token")) {
        userMessage = "Chave do Mercado Pago inválida. Contate o administrador.";
      } else if (mpData?.message?.includes("identification") || mpData?.message?.includes("payer")) {
        userMessage = "Erro ao gerar Pix: verifique se seu e-mail e CPF estão corretos.";
      } else if (mpData?.message?.includes("QR render") || mpData?.message?.includes("without key enabled")) {
        userMessage = "Erro: Chave Pix não configurada na conta recebedora. Verifique o painel do administrador.";
      }
      return new Response(JSON.stringify({ error: userMessage, mp_error: mpData?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;
    
    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
        ticket_url: pixInfo?.ticket_url || null,
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
