import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive().max(50000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { store_id, amount } = parsed.data;

    // Verify store ownership
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id, name")
      .eq("id", store_id)
      .eq("owner_id", userId)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada ou sem permissão." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify balance exists and has pending amount
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: balance } = await adminSupabase
      .from("store_balances")
      .select("repasse_pendente")
      .eq("store_id", store_id)
      .single();

    const pendingAmount = Number(balance?.repasse_pendente || 0);
    if (pendingAmount <= 0) {
      return new Response(JSON.stringify({ error: "Sem saldo pendente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Math.abs(amount - pendingAmount) > 0.01) {
      return new Response(JSON.stringify({ error: "Valor informado não confere com o saldo pendente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate PIX charge via Mercado Pago
    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Chave de pagamento não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get store owner profile for payer info
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email, document")
      .eq("user_id", userId)
      .single();

    const cleanCpf = String(profile?.document || "").replace(/\D/g, "");
    const nameParts = (profile?.full_name || "Lojista").split(" ");
    const firstName = nameParts[0] || "Lojista";
    const lastName = nameParts.slice(1).join(" ") || "ItaSuper";

    const referenceCode = `TAXA-${store_id.substring(0, 6).toUpperCase()}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    const paymentBody: Record<string, unknown> = {
      transaction_amount: Number(amount.toFixed(2)),
      description: `Taxa plataforma - ${store.name}`,
      payment_method_id: "pix",
      date_of_expiration: expiresAt,
      payer: {
        email: profile?.email || userData.user.email || "lojista@itasuper.com",
        first_name: firstName.substring(0, 100),
        last_name: lastName.substring(0, 100),
        ...(cleanCpf.length === 11 ? {
          identification: { type: "CPF", number: cleanCpf },
        } : {}),
      },
      external_reference: referenceCode,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": `store-fee-${store_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP PIX Error for store fee:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    // Record the transaction
    await adminSupabase.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge",
      amount,
      reference_code: referenceCode,
      status: "pending",
      provider: "mercado_pago",
      mercado_pago_payment_id: String(mpData.id),
      pix_qr_code: pixInfo?.qr_code || null,
      pix_qr_code_base64: pixInfo?.qr_code_base64 || null,
      pix_copy_paste: pixInfo?.qr_code || null,
      metadata: { type: "platform_fee", store_name: store.name },
    });

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        qr_code: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
        reference_code: referenceCode,
        amount,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("store-platform-fee-pix error:", err);
    return new Response(JSON.stringify({ error: "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
