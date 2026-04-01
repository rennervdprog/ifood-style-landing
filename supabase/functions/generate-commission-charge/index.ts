import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: only platform admin or store owner
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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { store_id, amount, description } = parsed.data;

    // Verify store exists and user is owner
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, owner_id")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow store owner or admin
    const userId = userData.user.id;
    const isAdmin = userData.user.email === "vinivias13@gmail.com";
    if (store.owner_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "MERCADO_PAGO_ACCESS_TOKEN não configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reference code
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: refData } = await serviceClient.rpc("generate_financial_reference", {
      _prefix: "FAT",
    });
    const referenceCode = refData || `#FAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await serviceClient
      .from("financial_transactions")
      .update({
        status: "cancelled",
        settled_at: createdAt,
        updated_at: createdAt,
      })
      .eq("store_id", store_id)
      .eq("transaction_kind", "commission_charge")
      .eq("status", "pending");

    // Create Mercado Pago PIX charge
    const desc = String(
      description || `Comissão FoodIta - ${store.name} - ${referenceCode}`
    ).substring(0, 256);

    const paymentBody = {
      transaction_amount: Number(amount.toFixed(2)),
      description: desc,
      payment_method_id: "pix",
      payer: {
        email: userData.user.email || "lojista@foodita.com",
        first_name: store.name.substring(0, 100),
        last_name: "FoodIta",
        identification: { type: "CPF", number: "00000000000" },
      },
      external_reference: referenceCode,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": `commission-${store_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP Commission Charge Error:", JSON.stringify(mpData));
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar cobrança PIX. Tente novamente.",
          mp_error: mpData?.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    // Save transaction record
    await serviceClient.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: "pending",
      provider: "mercado_pago",
      mercado_pago_payment_id: String(mpData.id),
      pix_qr_code: pixInfo?.qr_code || null,
      pix_qr_code_base64: pixInfo?.qr_code_base64 || null,
      pix_copy_paste: pixInfo?.qr_code || null,
      created_at: createdAt,
      updated_at: createdAt,
      metadata: { store_name: store.name, description: desc, expires_at: expiresAt },
    });

    return new Response(
      JSON.stringify({
        reference_code: referenceCode,
        payment_id: mpData.id,
        status: "pending",
        qr_code: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
        amount: Number(amount.toFixed(2)),
        created_at: createdAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
