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
  pix_key: z.string().min(1).max(256),
  pix_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
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

    // Only admin can do payouts - check user_roles table
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas o administrador pode realizar repasses." }), {
        status: 403,
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

    const { store_id, amount, pix_key, pix_type } = parsed.data;

    // Verify store exists
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: refData } = await serviceClient.rpc("generate_financial_reference", {
      _prefix: "REP",
    });
    const referenceCode = refData || `#REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Create Mercado Pago PIX payment to the store owner
    const desc = `Repasse FoodIta - ${store.name} - ${referenceCode}`;

    const paymentBody = {
      transaction_amount: Number(amount.toFixed(2)),
      description: desc.substring(0, 256),
      payment_method_id: "pix",
      payer: {
        email: userData.user.email || "admin@foodita.com",
        first_name: "FoodIta",
        last_name: "Admin",
        identification: { type: "CPF", number: "00000000000" },
      },
      external_reference: referenceCode,
    };

    // Note: Mercado Pago v1/payments creates a payment TO the account owner.
    // For a true payout/transfer to another account you'd use the Payouts API
    // or Marketplace split payments. This creates a PIX QR for the admin to
    // pay the store via the store owner's PIX key manually, with tracking.
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": `payout-${store_id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    // Save transaction regardless of MP result
    const txRecord: Record<string, unknown> = {
      store_id,
      transaction_kind: "store_payout",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: "pending",
      provider: "mercado_pago",
      metadata: {
        store_name: store.name,
        pix_key,
        pix_type,
        description: desc,
      },
    };

    if (mpResponse.ok) {
      txRecord.mercado_pago_payment_id = String(mpData.id);
      const pixInfo = mpData.point_of_interaction?.transaction_data;
      txRecord.pix_qr_code = pixInfo?.qr_code || null;
      txRecord.pix_qr_code_base64 = pixInfo?.qr_code_base64 || null;
      txRecord.pix_copy_paste = pixInfo?.qr_code || null;
    }

    await serviceClient.from("financial_transactions").insert(txRecord);

    if (!mpResponse.ok) {
      console.error("MP Payout Error:", JSON.stringify(mpData));
      // Even if MP fails, we record it and let admin do manual transfer
      return new Response(
        JSON.stringify({
          reference_code: referenceCode,
          status: "manual_required",
          message: `Não foi possível gerar PIX automático. Realize a transferência manual de R$ ${amount.toFixed(2)} para a chave PIX: ${pix_key} (${pix_type})`,
          pix_key,
          pix_type,
          amount: Number(amount.toFixed(2)),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    // Deduct from repasse_pendente
    await serviceClient
      .from("store_balances")
      .update({
        repasse_pendente: 0,
      })
      .eq("store_id", store_id);

    return new Response(
      JSON.stringify({
        reference_code: referenceCode,
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: pixInfo?.qr_code || null,
        qr_code_base64: pixInfo?.qr_code_base64 || null,
        amount: Number(amount.toFixed(2)),
        pix_key,
        pix_type,
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
